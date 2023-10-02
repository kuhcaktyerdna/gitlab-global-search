const request = require('request');
const fs = require('fs');

const args = process.argv.slice(2);

let baseUrl = process.env['REPO'];
let accessToken = process.env['ACCESS_TOKEN'];
let searchStr;

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

});

if (!searchStr) {
    throw new Error('No search string passed!');
}

if (!baseUrl) {
    throw new Error('No GitLab url passed!');
}

if (!accessToken) {
    throw new Error('No access token for GitLab passed!');
}

const getProjectsUrl = (pageNum) => `${baseUrl}/api/v4/projects?access_token=${accessToken}&per_page=500&page=${pageNum}`;
const getSearchInProjectUrl = (projectId) => `${baseUrl}/api/v4/projects/${projectId}/search?access_token=${accessToken}&scope=blobs&search=${searchStr}`;

let projects = [];

const getProjects = (pageNum, callback) => {
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
                    callback.call();
                }
            }
        }
    );
}

const searchOverProject = () => {
    console.info('========= START SEARCHING OVER THE PROJECTS =========')
    let checkedProjectsAmt = 0;
    let matchedProjects = 0;
    projects.forEach((project) => {
        request.get(
            getSearchInProjectUrl(project.id),
            (error, response, body) => {
                checkedProjectsAmt++;

                if (!error && response.statusCode === 200) {
                    const searchOccurences = JSON.parse(body);
                    if (searchOccurences.length > 0) {
                        matchedProjects++;
                        let repoData = `PROJECT URL: ${project['web_url']}`;
                        searchOccurences.forEach(({ ref, path, startline }) => {
                            repoData += `\n- branch: ${ref}`;
                            repoData += `\n  path: ${path}`;
                            repoData += `\n  line: ${startline}`;
                        });
                        repoData += '\n\n';
                        // for debug
                        // console.log(repoData);
                        fs.appendFileSync('./result.txt', repoData);
                    }
                }
                if (checkedProjectsAmt === projects.length) {
                    console.log(`Done. ${matchedProjects} matching projects have been written to result.txt file`);
                }
            }
        )
    });
}

console.log('============== START PROJECTS FETCHING ==============')
getProjects(1, searchOverProject);
