const request = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');

const booksUrl = 'http://web.mta.info/mta/news/books/';
var {
  lastSeenBoardMonth,
  lastSeenCommitteeMonth
} = require('./state.json');
const ENV = {
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_RECIPIENT: process.env.MAILGUN_RECIPIENT
};

const mailgun = require('mailgun-js')({
  apiKey: ENV.MAILGUN_API_KEY,
  domain: ENV.MAILGUN_DOMAIN
});

const getBooksPage = () => {
  return request({
    uri: booksUrl,
    transform: (body) => {
      return cheerio.load(body);
    }
  });
};

const notifyUser = (links) => {
  return new Promise(function(resolve, reject) {
    if (links.length > 0) {
      var data = {
        from: `Bookblast Bot <bot@${ENV.MAILGUN_DOMAIN}>`,
        to: ENV.MAILGUN_RECIPIENT,
        subject: 'Bookblast Run',
        text: ("" + JSON.stringify(links))
      };

      mailgun.messages().send(data, function(error, body) {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    } else {
      resolve([]);
    }
  });
};

const processPage = (page) => {
  return new Promise((resolve, reject) => {
    var links = [];

    // Committee
    var monthEl = page("div[class='span-46 push-1 last']").children('h3')[0];
    var month = monthEl.children[0].data;

    if (month !== lastSeenCommitteeMonth) {
      var links = monthEl.next.next.children
      .filter((el) => {
        return el.name === 'li';
      })
      .map((item) => {
        var linkEl = item.children[0];

        return {
          name: linkEl.children[0].data,
          url: `${booksUrl}/${linkEl.attribs.href}`
        };
      });

      lastSeenCommitteeMonth = month;
    }

    // Board
    var monthEl = page("div[class='span-37']").children('ul')[0];
    var linkEl = monthEl.children
    .filter((el) => {
      return el.name === 'li';
    })[0].children[0];

    var month = linkEl.children[0].data;

    if (month !== lastSeenBoardMonth) {
      links.push({
        name: month,
        url: `${booksUrl}/${linkEl.attribs.href}`
      });

      lastSeenBoardMonth = month;
    }

    resolve(links);
  });
};

getBooksPage()
.then(processPage)
.then(notifyUser)
.then(function(mailResp) {
  fs.writeFileSync(
    'state.json',
    JSON.stringify({ lastSeenBoardMonth, lastSeenCommitteeMonth })
  );

  console.log('successfully completed a run: ' + JSON.stringify(mailResp));
})
.catch(function(err) {
  throw err;
  console.log('err: ' + err);
});
