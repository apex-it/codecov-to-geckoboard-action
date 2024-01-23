import * as core from '@actions/core';
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import {config} from 'dotenv';
import {camelCase} from 'lodash-es';
import {CodecovRepoDetails, CodecovService} from './types.js';

if (process.env['DOTENV_CONFIG_PATH']) {
  config({path: process.env['DOTENV_CONFIG_PATH']});
} else {
  config();
}

const getRepoDetailsFromCodecov = async (
  service: CodecovService,
  owner: string,
  repo: string,
  token: string
): Promise<AxiosResponse<CodecovRepoDetails>> => {
  const options: AxiosRequestConfig = {
    method: 'GET',
    url: `https://api.codecov.io/api/v2/${service}/${owner}/repos/${repo}/`,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`
    },
    responseType: 'json'
  };

  return axios.request<CodecovRepoDetails>(options);
};

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

const repoWithoutOwner = (repoWithOwner: string, owner: string): string =>
  repoWithOwner.replace(`${owner}/`, '');

const run = async () => {
  try {
    const githubOwner = process.env['GITHUB_REPOSITORY_OWNER'];
    const githubRepoWithOwner = process.env['GITHUB_REPOSITORY'];

    const codecovToken =
      core.getInput('codecov-token') || process.env['CODECOV_TOKEN'];
    const geckoboardToken =
      core.getInput('geckoboard-token') || process.env['GECKOBOARD_TOKEN'];

    if (!githubRepoWithOwner) {
      throw new Error('Failed to get GITHUB_REPOSITORY from environment');
    }

    if (!githubOwner) {
      throw new Error('Failed to get GITHUB_REPOSITORY_OWNER from environment');
    }

    if (!codecovToken) {
      throw new Error('Failed to get input "codecov-token"');
    }

    if (!geckoboardToken) {
      throw new Error('Failed to get input "geckoboard-token"');
    }

    console.log(`Fetching coverage for ${githubRepoWithOwner} from Codecov`);

    let codecovResponse: AxiosResponse<CodecovRepoDetails>;

    try {
      codecovResponse = await getRepoDetailsFromCodecov(
        'github',
        githubOwner,
        repoWithoutOwner(githubRepoWithOwner, githubOwner),
        codecovToken
      );
    } catch (err) {
      if (err instanceof AxiosError) {
        const message = `Error from Codecov: ${err.code} - ${err.message}`;

        throw new Error(message);
      }

      throw new Error('Unknown error while getting data from Codecov');
    }

    const currentCoverage = codecovResponse.data.totals.coverage;

    if (typeof currentCoverage != 'number') {
      throw new Error('Failed to get current from Codecov');
    }

    console.log(`Current coverage is ${currentCoverage}`);

    console.log(
      `Creating dataset in Geckoboard: ${getGeckoboardDatasetUrl(githubRepoWithOwner)}`
    );

    await axios.put(
      getGeckoboardDatasetUrl(githubRepoWithOwner),
      createGeckoboardDataset(),
      {
        auth: {
          username: geckoboardToken,
          password: ''
        }
      }
    );

    console.log('Updating dataset in Geckoboard');

    await axios.post(
      getGeckoboardDatasetDataUrl(githubRepoWithOwner),
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
