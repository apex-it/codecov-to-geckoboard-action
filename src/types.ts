export type CodecovService =
  | 'github'
  | 'github_enterprise'
  | 'gitlab'
  | 'gitlab_enterprise'
  | 'bitbucket'
  | 'bitbucket_server';

export type CodecovRepoDetails = {
  totals: {
    coverage: number;
  };
};
