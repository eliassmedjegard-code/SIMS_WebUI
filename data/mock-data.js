// Mock data for functionality not yet backed by a real server (auth, RAG, history).
// Replace with real API responses once the backend described in README.md exists.

// Self-contained example queries: each names its own candidate/role so it
// makes sense as a one-click question with no prior context (there is no
// job-posting picker or CV upload in this app — a query only ever has
// whatever it states inline plus the indexed candidate database).
export const suggestionPrompts = [
  'Which candidates have at least 5 years of backend development experience with Python?',
  "Summarize Robin Fonseca's professional background and key skills.",
  'Does John Andersson meet the requirements for a Senior Data Analyst role (SQL, Python, 3+ years experience)?',
  'Compare Anna Berg and Johan Nilsson for suitability as a Project Manager.',
];

// Attached to a live assistant response so the RAG-shaped UI (sources,
// context indicator) can be demonstrated before real retrieval exists.
export const mockSourcesForLiveResponse = [
  {
    title: 'Jane Doe — CV',
    section: 'Work Experience',
    document: 'Jane_Doe_CV.pdf',
    page: 2,
  },
  {
    title: 'Senior Backend Developer — Job Description',
    section: 'Required Qualifications',
    document: 'Senior_Backend_Developer_JD.pdf',
    page: 1,
  },
];

export const mockContextForLiveResponse = {
  documentCount: 3,
  sectionCount: 7,
  documents: ['Jane Doe — CV', 'Senior Backend Developer — Job Description', 'Internal Staffing Guidelines'],
};
