module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    es6: true
  },
  plugins: [
    'markdown',
    'prettier'
  ],
  rules: {
    "prettier/prettier": "error"
  }
}
