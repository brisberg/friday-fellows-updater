const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const Chinmei = require('chinmei');

const myChinmei = new Chinmei('FridayFellows', '');

// myChinmei.verifyAuth()
//     .then(res => console.log(res))
//     .catch(err => console.log(err));

myChinmei.getMalUser('Phoenix37', 1, 'all')
    .then((res) => {
        console.log(res.anime.length);
        // console.log(res);
    })
    .catch(err => console.log(err));

myChinmei.searchAnimes('Gegege no Kitaro (2018)')
    .then(res => console.log(res))
    .catch(err => console.log(err));

myChinmei.searchSingleAnime('Gegege no Kitaro (2018)')
    .then(res => console.log(res))
    .catch(err => console.log(err));

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
