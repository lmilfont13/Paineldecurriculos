export interface SearchCandidateItem {
  id: string;
  name: string;
  email: string;
  jobId: string;
  jobTitle: string;
  status: string;
  aiScore: number | null;
}

export interface SearchJobItem {
  id: string;
  title: string;
  code: string | null;
  status: string;
  applicationsCount: number;
}

export interface GlobalSearchResult {
  candidates: SearchCandidateItem[];
  jobs: SearchJobItem[];
}
