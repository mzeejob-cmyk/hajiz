import { FeedbackAlert } from "./FeedbackAlert.jsx"
import { SEARCH_STATES } from "../data/searchStates.js"
export function SearchState({ state }) { const content = SEARCH_STATES[state]; return <section className="search-state" data-search-state={state}><h2>{content.title}</h2><FeedbackAlert tone={content.tone} title={content.title}>{content.body}</FeedbackAlert></section> }
