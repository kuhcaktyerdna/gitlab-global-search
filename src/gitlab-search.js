const request = require('request');
const fs = require('fs');
const prompt = require('prompt-sync')();

console.log(`
   ____ _ _   _       _         ____                      _     
  / ___(_) |_| | __ _| |__     / ___|  ___  __ _ _ __ ___| |__  
 | |  _| | __| |/ _\` | '_ \\    \\___ \\ / _ \\/ _\` | '__/ __| '_ \\ 
 | |_| | | |_| | (_| | |_) |    ___) |  __/ (_| | | | (__| | | |
  \\____|_|\\__|_|\\__,_|_.__/    |____/ \\___|\\__,_|_|  \\___|_| |_|
                                                                           v 1.0.3                                     
`);

const args = process.argv.slice(2);

let baseUrl = process.env['REPO'];
let accessToken = process.env['ACCESS_TOKEN'];
let searchStr;
let isRawReport = false;
let cacheRepos = false;

args.forEach(arg => {
    if (arg.startsWith('--access-token')) {
        accessToken = arg.split('=')[1];
    }

    if (arg.startsWith('--repo')) {
        baseUrl = arg.split('=')[1];
    }

    if (arg.startsWith('--search')) {
        searchStr = arg.split('=')[1];
    }

    if (arg.startsWith('--raw')) {
        isRawReport = true;
    }

    if (arg.startsWith('--cache-repos')) {
        cacheRepos = true;
    }
});

const OUTPUT_DIR = './output';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

const OUTPUT_FILE = `${OUTPUT_DIR}/${isRawReport && 'result.txt' || 'result.md'}`;
const CACHE_REPOS_FILE = `${OUTPUT_DIR}/repos.json`;
fs.existsSync(OUTPUT_FILE) && fs.unlinkSync(OUTPUT_FILE);

if (!searchStr) {
    searchStr = prompt('Please input search term: ');
}

if (!baseUrl) {
    console.error('[ERROR] No GitLab url passed! Please provide it via --repo parameter');
    process.exit(1);
}

if (!accessToken) {
    console.error('[ERROR] No access token for GitLab passed! Please provide it via --access-token parameter');
    process.exit(1);
}

const getProjectsUrl = (pageNum) => `${baseUrl}/api/v4/projects?access_token=${accessToken}&per_page=100&page=${pageNum}`;
const getSearchInProjectUrl = (projectId) => `${baseUrl}/api/v4/projects/${projectId}/search?access_token=${accessToken}&scope=blobs&search=${searchStr}`;

let projects = [];

const getProjects = (pageNum, callback) => {
    if (cacheRepos && fs.existsSync(CACHE_REPOS_FILE)) {
        projects = JSON.parse(fs.readFileSync(CACHE_REPOS_FILE));
        console.log(`Caching enabled. Read ${projects.length} projects from cache file`);
        callback.call();
    } else {
        request.get(
            getProjectsUrl(pageNum),
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const newProjects = JSON.parse(body);

                    if (newProjects.length > 0) {
                        projects = [...projects, ...newProjects];
                        getProjects(++pageNum, callback);
                    } else {
                        console.log(`Done. Found ${projects.length} projects on ${baseUrl}`);
                        cacheRepos && fs.writeFileSync(CACHE_REPOS_FILE, JSON.stringify(
                            projects.map(({id, web_url}) => ({id, web_url}))
                        ));
                        callback.call();
                    }
                }
            }
        );
    }
}

const searchOverProject = () => {
    console.info('========= START SEARCHING OVER THE PROJECTS =========')
    let checkedProjectsAmt = 0;
    let matchedProjects = 0;
    let totalMatches = 0;
    projects.forEach((project) => {
        request.get(
            getSearchInProjectUrl(project.id),
            (error, response, body) => {
                checkedProjectsAmt++;

                if (!error && response.statusCode === 200) {
                    const searchOccurrences = JSON.parse(body);
                    if (searchOccurrences.length > 0) {
                        matchedProjects++;
                        let repoData = `PROJECT URL: ${project['web_url']}`;
                        searchOccurrences.forEach(({ref, path, startline, data}) => {
                            totalMatches++;
                            const dataLines = data.toLowerCase().split('\n');
                            let actualLine = startline + dataLines
                                .findIndex(line => line.includes(searchStr.toLowerCase()));

                            if (isRawReport) {
                                repoData += `\n- branch: ${ref}`;
                                repoData += `\n  path: ${path}`;
                                repoData += `\n  line: ${actualLine}`;
                            } else {
                                const occurrence = '\n```\n' + data + '```';
                                repoData += `\n- branch: \`${ref}\` <br/>`;
                                repoData += `\n  path: \`${path}\` <br/>`;
                                repoData += `\n  line: \`${actualLine}\` <br/>`;
                                repoData +=
                                    `\n  occurrence: [link](${project['web_url']}/-/blob/${ref}/${path}#L${actualLine})` +
                                    occurrence
                                ;
                            }
                        });
                        repoData += '\n\n';
                        // for debug
                        // console.debug(repoData);
                        fs.appendFileSync(OUTPUT_FILE, repoData);
                    }
                }
                if (checkedProjectsAmt === projects.length) {
                    console.log(`Done. ${matchedProjects} matching projects have been written to ${OUTPUT_FILE} file. Total matches is ${totalMatches}`);
                }
            }
        )
    });
}

console.log('============== START PROJECTS FETCHING ==============')
getProjects(1, searchOverProject);
