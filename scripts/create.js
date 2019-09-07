const path = require('path');
const fs = require('fs');
const util = require('util');
const fetch = require('node-fetch');
const { CookieJar } = require('tough-cookie');
const { GraphQLClient } = require('graphql-request');
const TurndownService = require('turndown');
const TurndownPluginGfm = require('turndown-plugin-gfm');
const ejs = require('ejs');

async function getCookies(domain = 'leetcode.com') {
  const url = `https://${domain}/problemset/all/`;
  const response = await fetch(url);
  const cookies = response.headers.raw()['set-cookie'];
  const jar = new CookieJar();
  const setCookie = util.promisify(jar.setCookie.bind(jar));
  await Promise.all(cookies.map(cookie => setCookie(cookie, url)));
  return jar;
}

const query = `query getQuestionDetail($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    questionTitle
    translatedTitle
    questionTitleSlug
    content
    translatedContent
    difficulty
    codeDefinition,
    questionDetailUrl
  }
}`;

async function request(title, domain = 'leetcode.com') {
  const page = `https://${domain}/problems/${title}`;
  const cookieJar = await getCookies(domain);
  const cookies = await util.promisify(cookieJar.getCookies.bind(cookieJar))(
    page
  );
  const csrfToken = cookies.find(cookie => cookie.key === 'csrftoken').value;

  const graphQLClient = new GraphQLClient(`https://${domain}/graphql`, {
    headers: {
      referer: page,
      cookie: cookies.map(cookie => cookie.cookieString()).join(';'),
      'x-csrftoken': csrfToken
    }
  });
  return graphQLClient.request(query, { titleSlug: title });
}

function createTurndownService() {
  const turndown = new TurndownService();
  turndown.use(TurndownPluginGfm.gfm);
  turndown.keep('pre');
  return turndown;
}

function normalizeSpaces(s) {
  return s.replace(/\u00a0/g, ' ');
}

function render(template, data) {
  const turndown = createTurndownService();
  const { question } = data;
  const codeDefinition = JSON.parse(question.codeDefinition);
  const javascript = codeDefinition.find(
    definition => definition.value === 'javascript'
  );

  return ejs.render(template, {
    ...question,
    content: normalizeSpaces(turndown.turndown(question.content)),
    translatedContent: normalizeSpaces(
      turndown.turndown(question.translatedContent)
    ),
    defaultCode: javascript.defaultCode
  });
}

function numLeftPad(n, digit = 3) {
  return ('0'.repeat(digit) + n).slice(-digit);
}

async function main(title) {
  const data = await request(title, 'leetcode-cn.com');
  const result = render(
    fs.readFileSync(path.join(__dirname, 'solution-template.md'), {
      encoding: 'utf8'
    }),
    data
  );
  const { question } = data;
  const fileName = `${numLeftPad(question.questionId)}. ${
    question.questionTitle
  }.md`;
  fs.writeFileSync(path.resolve('solutions', fileName), result, 'utf8');
}

if (process.argv[2]) {
  const name = process.argv[2];
  const matched = name.match(
    /^(?:https?:\/\/)?leetcode(?:-cn)?\.com\/problems\/([\w-]+)\/?$/
  );
  main(matched ? matched[1] : name);
}
