// lib/services/gitHubStatsService.js
import { escapeHTML, bold, code } from '@/lib/utils/htmlEscaper'; // Asumo que tienes estas utilidades

const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * Fetches data from the GitHub API.
 * @param {string} endpoint - The API endpoint (e.g., /repos/owner/repo/commits).
 * @param {string} token - GitHub Personal Access Token.
 * @param {object} [options={}] - Fetch options.
 * @returns {Promise<any>} - The JSON response.
 */
async function fetchGitHubAPI(endpoint, token, options = {}) {
  const url = `${GITHUB_API_BASE_URL}${endpoint}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${token}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`GitHub API Error: ${response.status} ${response.statusText} - ${url}`, errorBody);
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}. Details: ${errorBody}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching GitHub API endpoint ${endpoint}:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

/**
 * Fetches repository contribution statistics.
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {string} token - GitHub PAT.
 * @param {string} [sinceISO] - Optional ISO 8601 string to fetch commits since this date.
 * @param {string} [branch='main'] - Optional branch name. Defaults to 'main'.
 * @returns {Promise<Object|null>} - Aggregated contributor statistics or null on failure.
 */
export async function getRepoContributionStats(owner, repo, token, sinceISO, branch = 'main') {
  const contributors = {};
  let page = 1;
  const perPage = 30; // GitHub API default is 30, max 100. Let's use 30 to be safe with subsequent calls.
  let hasMoreCommits = true;
  let totalCommitsFetched = 0;

  console.log(`[gitHubStatsService] Fetching stats for ${owner}/${repo}, branch: ${branch}, since: ${sinceISO || 'beginning'}`);

  try {
    while (hasMoreCommits) {
      let commitsUrl = `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}&page=${page}`;
      if (sinceISO) {
        commitsUrl += `&since=${sinceISO}`;
      }

      const commitsPage = await fetchGitHubAPI(commitsUrl, token);
      
      if (!commitsPage || commitsPage.length === 0) {
        hasMoreCommits = false;
        break;
      }
      totalCommitsFetched += commitsPage.length;
      // console.log(`[gitHubStatsService] Page ${page}: Fetched ${commitsPage.length} commit summaries. Total: ${totalCommitsFetched}`);

      for (const commitSummary of commitsPage) {
        if (!commitSummary.author || !commitSummary.sha) {
          // console.warn('[gitHubStatsService] Skipping commit summary, missing author or SHA:', commitSummary.html_url || 'No URL');
          continue;
        }
        
        // Fetch detailed info for each commit to get stats (additions/deletions)
        // This is API-intensive. The commit list items often don't have full stats.
        const detailedCommit = await fetchGitHubAPI(`/repos/${owner}/${repo}/commits/${commitSummary.sha}`, token);
        
        const authorLogin = detailedCommit.author ? detailedCommit.author.login : 'unknown_contributor';
        // Use commit.author.name for display, fallback to login
        const authorName = (detailedCommit.commit.author && detailedCommit.commit.author.name) ? detailedCommit.commit.author.name : authorLogin;

        if (!contributors[authorLogin]) {
          contributors[authorLogin] = {
            name: authorName,
            commits: 0,
            additions: 0,
            deletions: 0,
            totalModifications: 0,
          };
        }

        contributors[authorLogin].commits += 1;
        if (detailedCommit.stats) {
          contributors[authorLogin].additions += detailedCommit.stats.additions || 0;
          contributors[authorLogin].deletions += detailedCommit.stats.deletions || 0;
          contributors[authorLogin].totalModifications += (detailedCommit.stats.additions || 0) + (detailedCommit.stats.deletions || 0);
        }
      }

      if (commitsPage.length < perPage) {
        hasMoreCommits = false; // This was the last page
      } else {
        page++;
      }
    }
    
    console.log(`[gitHubStatsService] Finished fetching. Total commits processed: ${totalCommitsFetched}. Contributors: ${Object.keys(contributors).length}`);
    return contributors;

  } catch (error) {
    console.error('[gitHubStatsService] Critical error fetching or processing contribution stats:', error);
    return null; // Indicate failure
  }
}
