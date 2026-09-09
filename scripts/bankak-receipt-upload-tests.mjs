import assert from "node:assert/strict"
import fs from "node:fs"
import { createBankakReceiptUploadDataSource, MAX_BANKAK_RECEIPT_BYTES } from "../src/services/bankakReceiptUploadDataSource.js"
import { parseFlightPaymentInitiationHttpResponseV1 } from "../src/features/flights/api/flightPaymentInitiationClientV1.js"

let passed=0
const test=async(name,fn)=>{await fn();passed++;console.log(`PASS ${passed}: ${name}`)}
const rejects=async(fn,code)=>assert.equal(await fn().then(()=>"",e=>e.message),code)
const uid="11111111-1111-4111-8111-111111111111", pid="22222222-2222-4222-8222-222222222222", rid="33333333-3333-4333-8333-333333333333", sha="a".repeat(64)
let calls=[]
const mock=(o={})=>({auth:{getUser:async()=>o.authThrow?Promise.reject(new Error("secret")):{data:{user:o.noUser?null:{id:uid}},error:o.authError?new Error("secret"):null}},storage:{from:b=>{calls.push(["bucket",b]);return{upload:async(...a)=>{calls.push(["upload",...a]);if(o.uploadThrow)throw Error("secret");return{error:o.uploadError?Error("secret"):null}}}}},functions:{invoke:async(...a)=>{calls.push(["invoke",...a]);if(o.edgeThrow)throw Error("secret");return{error:o.edgeError?Error("secret"):null,data:Object.hasOwn(o,"response")?o.response:{accepted:true,detectedMime:"image/jpeg",sha256:sha}}}}})
const ds=(o={})=>createBankakReceiptUploadDataSource({getClient:()=>mock(o),createId:()=>rid})
const file=(type="image/jpeg",size=3,name="PRIVATE.jpg")=>({type,size,name})
const upload=(o={},f=file())=>ds(o).upload({paymentId:pid,file:f})

await test("auth required",()=>rejects(()=>upload({noUser:true}),"BANKAK_RECEIPT_AUTH_REQUIRED"))
await test("auth error redacted",()=>rejects(()=>upload({authError:true}),"BANKAK_RECEIPT_AUTH_REQUIRED"))
await test("auth throw redacted",()=>rejects(()=>upload({authThrow:true}),"BANKAK_RECEIPT_AUTH_REQUIRED"))
for(const [m,e] of [["image/jpeg","jpg"],["image/png","png"],["application/pdf","pdf"]])await test(`${m} accepted`,async()=>{calls=[];await upload({response:{accepted:true,detectedMime:m,sha256:sha}},file(m));assert.equal(calls[1][1],`${uid}/${pid}/receipt-${rid}.${e}`)})
await test("unsupported rejected",()=>rejects(()=>upload({},file("text/plain")),"BANKAK_RECEIPT_INVALID_FILE"))
await test("zero rejected",()=>rejects(()=>upload({},file("image/jpeg",0)),"BANKAK_RECEIPT_INVALID_FILE"))
await test("oversize rejected",()=>rejects(()=>upload({},file("image/jpeg",MAX_BANKAK_RECEIPT_BYTES+1)),"BANKAK_RECEIPT_INVALID_FILE"))
await test("maximum accepted",()=>upload({},file("image/jpeg",MAX_BANKAK_RECEIPT_BYTES)))
await test("invalid payment rejected",()=>rejects(()=>ds().upload({paymentId:"bad",file:file()}),"BANKAK_RECEIPT_INVALID_FILE"))
await test("extra input rejected",()=>rejects(()=>ds().upload({paymentId:pid,file:file(),userId:uid}),"BANKAK_RECEIPT_INVALID_FILE"))
await test("bucket exact",async()=>{calls=[];await upload();assert.equal(calls[0][1],"receipts")})
await test("generated name",async()=>{calls=[];await upload();assert.ok(!calls[1][1].includes("PRIVATE"))})
await test("path exact",async()=>{calls=[];await upload();assert.equal(calls[1][1],`${uid}/${pid}/receipt-${rid}.jpg`)})
await test("content type",async()=>{calls=[];await upload();assert.equal(calls[1][3].contentType,"image/jpeg")})
await test("upsert false",async()=>{calls=[];await upload();assert.equal(calls[1][3].upsert,false)})
await test("function exact",async()=>{calls=[];await upload();assert.equal(calls[2][1],"inspect-payment-receipt")})
await test("function body exact",async()=>{calls=[];await upload();assert.deepEqual(calls[2][2],{body:{paymentId:pid,objectName:`${uid}/${pid}/receipt-${rid}.jpg`}})})
await test("upload error redacted",()=>rejects(()=>upload({uploadError:true}),"BANKAK_RECEIPT_UPLOAD_FAILED"))
await test("upload throw redacted",()=>rejects(()=>upload({uploadThrow:true}),"BANKAK_RECEIPT_UPLOAD_FAILED"))
await test("edge error redacted",()=>rejects(()=>upload({edgeError:true}),"BANKAK_RECEIPT_INSPECTION_FAILED"))
await test("edge throw redacted",()=>rejects(()=>upload({edgeThrow:true}),"BANKAK_RECEIPT_INSPECTION_FAILED"))
for(const response of [null,{}, {accepted:false,detectedMime:"image/jpeg",sha256:sha},{accepted:true,detectedMime:"bad",sha256:sha},{accepted:true,detectedMime:"image/jpeg",sha256:"A".repeat(64)},{accepted:true,detectedMime:"image/jpeg",sha256:sha,x:1}])await test("strict response rejection",()=>rejects(()=>upload({response}),"BANKAK_RECEIPT_RESPONSE_INVALID"))

const base={contractVersion:"customer-flight-payment-initiation-http/v1",data:{contractVersion:"flight-payment-initiation/v1",initiationStatus:"PAYMENT_INITIATED",bookingRef:"HJZ-ABCDEF123456",paymentId:pid,paymentMethod:"bankak",paymentStatus:"awaiting",bookingStatus:"pending_payment",amount:"10.00",currency:"SDG",expiresAt:"2099-01-01T00:00:00Z",nextAction:"COMPLETE_BANKAK_TRANSFER",handoff:{type:"BANKAK_MANUAL",amount:"10.00",currency:"SDG",paymentReference:"PAY-ABCDEF123456",bankAccountDisplayName:"HAJIZ",maskedAccountNumber:"****1234",receiptUploadAvailable:false}}}
await test("parser false",async()=>assert.equal(parseFlightPaymentInitiationHttpResponseV1(base).handoff.receiptUploadAvailable,false))
await test("parser true",async()=>assert.equal(parseFlightPaymentInitiationHttpResponseV1({...base,data:{...base.data,handoff:{...base.data.handoff,receiptUploadAvailable:true}}}).handoff.receiptUploadAvailable,true))
for(const v of [null,"true",1,undefined])await test("parser rejects invalid capability",async()=>assert.throws(()=>parseFlightPaymentInitiationHttpResponseV1({...base,data:{...base.data,handoff:{...base.data.handoff,receiptUploadAvailable:v}}})))
await test("parser rejects extra field",async()=>assert.throws(()=>parseFlightPaymentInitiationHttpResponseV1({...base,data:{...base.data,handoff:{...base.data.handoff,x:true}}})))

const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8")
const edge=read("../supabase/functions/inspect-payment-receipt/index.ts"), deno=read("../supabase/functions/inspect-payment-receipt/deno.json"), config=read("../supabase/config.toml"), ui=read("../src/features/flights/components/BankakReceiptUpload.jsx"), page=read("../src/features/flights/FlightsPage.jsx"), server=read("../src/server/payments/flightPaymentInitiationV1.js")
for(const [name,text,needle] of [
 ["OPTIONS",edge,'req.method === "OPTIONS"'],["POST only",edge,'req.method !== "POST"'],["CORS",edge,"corsHeaders"],["body bound",edge,"MAX_REQUEST_BYTES = 2048"],["file bound",edge,"10 * 1024 * 1024"],["edge auth",edge,"AUTH_REQUIRED"],["exact request",edge,'Object.keys(input).length !== 2'],["owner segment",edge,"segments[0] !== userId"],["payment segment",edge,"segments[1] !== input.paymentId"],["safe filename",edge,"const FILE = /^receipt-"],["safe RPC error",edge,"RECEIPT_REGISTRATION_REJECTED"],["success shape",edge,"accepted: true"],["dependency pin",deno,"2.116.0"],["verify jwt",config,"[functions.inspect-payment-receipt]\nverify_jwt = true"],["accept exact",ui,'accept="image/jpeg,image/png,application/pdf"'],["uploading",ui,'state === "uploading"'],["accepted",ui,'state === "accepted"'],["error",ui,'state === "error"'],["retry",ui,"إعادة المحاولة"],["no confirmation claim",ui,"هذا لا يعني تأكيد الحجز"],["true gate",page,"receiptUploadAvailable === true"],["false gate",page,"رفع الإيصال غير متاح"],["trusted config",server,"bankakConfig.receiptUploadAvailable"],["false default",server,"bankakShapeValid && bankakConfig.receiptUploadAvailable === true"],["boolean config",server,'typeof bankakConfig.receiptUploadAvailable === "boolean"'],["card unaffected",server,"PSP_SESSION"],["browser request excludes capability",server,'initiateOnce({ owner, bookingIntentId: input.bookingIntentId, paymentMethod: input.paymentMethod, idempotencyKey: input.idempotencyKey }']
])await test(name,async()=>assert.ok(text.includes(needle),needle))
assert.ok(passed>=60)
console.log(`BANKAK RECEIPT UPLOAD TESTS: ${passed}/${passed} PASS`)
