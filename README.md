# gitlab-global-search

 node.js script which provides a possibility to search over all GitLab repositories files for some search term  

## Used dependencies
+ requests 
+ fs 

## Setting up the project
```
npm i
```

## Running the script 
```
node gitlab-search.js --search=<search-term> --repo=https://test.gitlab.com --access-token=<acc-token>
```
Where
+ --search — search term;
+ --repo — GitLab URL;
+ --access-token — Access token for your GitLab account 