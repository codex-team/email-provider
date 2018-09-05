# Email provider service detector 

Detect Provider's Service name by email address

```js
team@youtube.com -> { name: 'Gmail', url: 'https://googlemail.com' }
test@kinopoisk.ru -> { name: 'Яндекс', url: 'https://yandex.ru' }

```

## How it words

1. Fetching DNS MX records for email address
2. Find MX host at the free email services datastore, collected by [freemail](https://github.com/willwhite/freemail/blob/master/data/free.txt)
3. Find Service product name by its hostname (`googlemail.com` -> `Gmail`) 

## Usage

### Install

```js
npm i --save email-provider
```

or

```js
yarn add email-provider
```

### Connect and call

```js 
const emailProvider = require('email-provider');

let email = 'test@google.com';

emailProvider.get(email)
     .then( service => {
       console.log(service);
     })
     .catch( error => {
       console.log('Email provider was not reached:', error);
     })
```

