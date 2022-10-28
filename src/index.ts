import * as core from '@actions/core';
import axios from 'axios';
import {camelCase} from 'lodash';

const getCodecovUrl = (repo: string, token: string): string =>
  `https://codecov.io/api/gh/${repo}?access_token=${token}`;

const getGeckoboardDatasetUrl = (repo: string): string =>
  `https://api.geckoboard.com/datasets/${camelCase(repo).toLowerCase()}.by_day`;

const getGeckoboardDatasetDataUrl = (repo: string): string =>
  `${getGeckoboardDatasetUrl(repo)}/data`;

const createGeckoboardDataset = (): object => ({
  fields: {
    coverage: {
      type: 'number',
      name: 'Coverage',
      optional: false
    },
    timestamp: {
      type: 'datetime',
      name: 'Date'
    }
  },
  unique_by: ['timestamp']
});

const createGeckoboardDatasetData = (coverage: number | string): object => ({
  data: [
    {
      coverage: Number(coverage),
      timestamp: new Date()
    }
  ]
});

type CodecovResponse = {
  commit: {
    totals: {
      c: number;
    };
  };
};

const run = async () => {
  try {
    const githubRepo = process.env.GITHUB_REPOSITORY;

    const codecovToken =
      core.getInput('codecov-token') || process.env.CODECOV_TOKEN;
    const geckoboardToken =
      core.getInput('geckoboard-token') || process.env.GECKOBOARD_TOKEN;

    if (!githubRepo) {
      throw new Error('Failed to get GITHUB_REPOSITORY from environment');
    }

    if (!codecovToken) {
      throw new Error('Failed to get input "codecov-token"');
    }

    if (!geckoboardToken) {
      throw new Error('Failed to get input "geckoboard-token"');
    }

    const codecovUrl = getCodecovUrl(githubRepo, codecovToken);
    const codecovResponse = await axios.get<CodecovResponse>(codecovUrl);

    const currentCoverage = codecovResponse.data?.commit?.totals?.c;

    if (!currentCoverage) {
      throw new Error('Failed to get current from Codecov');
    }

    await axios.put(
      getGeckoboardDatasetUrl(githubRepo),
      createGeckoboardDataset(),
      {
        auth: {
          username: geckoboardToken,
          password: ''
        }
      }
    );

    await axios.post(
      getGeckoboardDatasetDataUrl(githubRepo),
      createGeckoboardDatasetData(currentCoverage),
      {
        auth: {
          username: geckoboardToken,
          password: ''
        }
      }
    );

    core.setOutput('coverage', currentCoverage);
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message);
    } else {
      core.setFailed('Unknown error while executing');
    }
  }
};

void run();
