// Mock data for functionality not yet backed by a real server (auth, RAG, history).
// Replace with real API responses once the backend described in README.md exists.

export const mockUser = {
  name: 'Elias',
  role: 'Compliance Analyst',
  initials: 'E',
};

// Grouped by relative date bucket for the sidebar. `messages` uses the same
// shape produced by chat.js so mock conversations render identically to live ones.
export const mockConversations = [
  {
    id: 'conv-eu-ai-act-scope',
    title: 'EU AI Act applicability',
    updatedAt: daysAgo(0),
    messages: [
      {
        role: 'user',
        content: 'Which AI requirements apply to our organization?',
      },
      {
        role: 'assistant',
        content:
          "Based on the documents indexed so far, your organization likely falls under the **EU AI Act** as a *provider* for at least one internal system, plus obligations from the **Internal AI Policy**.\n\nKey applicable requirements:\n\n- Risk classification of each AI system\n- Human oversight measures for high-risk systems\n- Technical documentation and record-keeping\n- Transparency obligations toward end users\n\n> This is a mock response for prototype purposes and does not reflect real retrieval.",
        sources: [
          {
            title: 'EU AI Act',
            section: 'Article 6 — Classification Rules',
            document: 'EU_AI_Act.pdf',
            page: 18,
          },
          {
            title: 'Internal AI Policy',
            section: 'Section 2 — Applicability',
            document: 'Internal_AI_Policy.pdf',
            page: 4,
          },
        ],
        context: {
          documentCount: 3,
          sectionCount: 8,
          documents: ['EU AI Act', 'Internal AI Policy', 'AI Risk Management Procedure'],
        },
      },
    ],
  },
  {
    id: 'conv-human-oversight',
    title: 'Human oversight requirements',
    updatedAt: daysAgo(1),
    messages: [
      {
        role: 'user',
        content: 'Show requirements concerning human oversight.',
      },
      {
        role: 'assistant',
        content:
          "Human oversight requirements generally require that a system:\n\n1. Can be monitored during operation\n2. Allows a human to intervene or halt the system\n3. Is designed to avoid automation bias\n\n```text\nExample control: \"Two-person review\" required before\nany high-risk automated decision is finalized.\n```\n\nThese controls map to the *Internal AI Policy* and the *AI Risk Management Procedure*.",
        sources: [
          {
            title: 'EU AI Act',
            section: 'Article 14 — Human Oversight',
            document: 'EU_AI_Act.pdf',
            page: 42,
          },
        ],
        context: {
          documentCount: 2,
          sectionCount: 5,
          documents: ['EU AI Act', 'AI Risk Management Procedure'],
        },
      },
    ],
  },
  {
    id: 'conv-policy-gaps',
    title: 'Policy gap analysis',
    updatedAt: daysAgo(6),
    messages: [
      {
        role: 'user',
        content: 'Are there gaps in our AI policy?',
      },
      {
        role: 'assistant',
        content:
          'A preliminary comparison surfaces a few possible gaps:\n\n| Area | Covered | Notes |\n|---|---|---|\n| Human oversight | Yes | Matches Article 14 |\n| Incident reporting | Partial | No defined SLA |\n| Third-party model vetting | No | Not addressed in current policy |\n\nConsider updating the Internal AI Policy to address third-party model vetting explicitly.',
        sources: [
          {
            title: 'Internal AI Policy',
            section: 'Section 7 — Incident Handling',
            document: 'Internal_AI_Policy.pdf',
            page: 11,
          },
        ],
        context: {
          documentCount: 3,
          sectionCount: 6,
          documents: ['Internal AI Policy', 'AI Risk Management Procedure', 'EU AI Act'],
        },
      },
    ],
  },
  {
    id: 'conv-regulatory-update',
    title: 'Latest regulatory update summary',
    updatedAt: daysAgo(14),
    messages: [
      {
        role: 'user',
        content: "What's changed in the latest regulatory update?",
      },
      {
        role: 'assistant',
        content:
          'The most recent tracked update introduces clarified guidance on general-purpose AI model obligations, effective in phases.\n\n- Additional transparency requirements for GPAI providers\n- Updated technical documentation templates\n- Revised timelines for high-risk system conformity assessments',
        sources: [
          {
            title: 'EU AI Act',
            section: 'Article 53 — Obligations for GPAI Providers',
            document: 'EU_AI_Act.pdf',
            page: 77,
          },
        ],
        context: {
          documentCount: 1,
          sectionCount: 3,
          documents: ['EU AI Act'],
        },
      },
    ],
  },
];

export const suggestionPrompts = [
  'Which AI requirements apply to our organization?',
  'Show requirements concerning human oversight.',
  'Are there gaps in our AI policy?',
  "What's changed in the latest regulatory update?",
];

// Attached to a live assistant response so the RAG-shaped UI (sources,
// context indicator) can be demonstrated before real retrieval exists.
export const mockSourcesForLiveResponse = [
  {
    title: 'EU AI Act',
    section: 'Article 14 — Human Oversight',
    document: 'EU_AI_Act.pdf',
    page: 42,
  },
  {
    title: 'Internal AI Policy',
    section: 'Section 2 — Applicability',
    document: 'Internal_AI_Policy.pdf',
    page: 4,
  },
];

export const mockContextForLiveResponse = {
  documentCount: 3,
  sectionCount: 8,
  documents: ['EU AI Act', 'Internal AI Policy', 'AI Risk Management Procedure'],
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
