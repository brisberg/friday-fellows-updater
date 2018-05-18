# Friday-fellows-updater
Simple nodejs container for updating MAL progress for Friday Fellows


Mal Testing page to fetch the list:
https://myanimelist.net/malappinfo.php?u=Phoenix37&type=anime


myChinmei.searchSingleAnime('Gegege no Kitaro (2018)')
    .then(res => console.log(res))
    .catch(err => console.log(err));


## Local Development:

`npm install`

`npm start`


## Run with Docker:

`docker run -it --rm --name friday-fellows-updater -v "$PWD":/usr/src/app -w /usr/src/app node:10-slim node dist/app.js`

Note: ARM arch only has node:10, node:10-slim, and node:10-stretch. 10-slim is the smallest available for now
