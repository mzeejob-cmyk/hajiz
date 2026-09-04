& {
    $ErrorActionPreference = 'Stop'
    foreach ($s1bPart in @('ANON','SERVICE_ROLE')) {
        $s1bPtr = [IntPtr]::Zero
        $s1bSecure = $null
        try {
            $s1bName = 'HAJIZ_STAGING_' + $s1bPart + '_KEY'
            $s1bSecure = Read-Host ('Enter Staging ' + $s1bPart + ' JWT key (hidden)') -AsSecureString
            if ($s1bSecure.Length -eq 0) { throw 'Empty input' }
            $s1bPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1bSecure)
            $s1bPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($s1bPtr)
            [Environment]::SetEnvironmentVariable($s1bName,$s1bPlain,'Process')
            Write-Host ($s1bPart + ' KEY AVAILABLE')
        } catch { Write-Host 'AUTH ENV CONFIGURATION BLOCKED'; break }
        finally {
            if ($s1bPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($s1bPtr) }
            if ($null -ne $s1bSecure) { $s1bSecure.Dispose() }
            Remove-Variable s1bPlain,s1bSecure,s1bPtr -ErrorAction SilentlyContinue
            $Error.Clear()
        }
    }
}
