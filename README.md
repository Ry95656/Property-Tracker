# property tracker

![property tracker](Property%20track.png)

app I made to keep track of rent, repairs, complaints and appointments for my rental properties. styled it like an old paper book instead of a normal dashboard.

## how to run it locally

1. npm install
2. npm run dev
3. open the link it prints 

## deploying to vercel

1. push this folder to a github repo
2. go to vercel.com, "add new project", import the repo
3. it should auto detect vite, just leave the settings default (
4. click deploy

or with the cli instead of the dashboard:

```
npm i -g vercel
vercel
```

## stuff to know

- data saves in the browser (localStorage):
  - if you deploy this live, each visitor gets their own separate data, it doesnt sync between devices
  - clearing browser data wipes it
- repair photos save too, dont go too crazy with them since browser storage isnt huge
- App.jsx imports a small `storage` helper from `storage.js` (wraps localStorage) — dont swap that for `window.storage`, that doesnt exist in a normal browser and will break the app

## AI declaration
- I used help from AI for the package lock so 'npm install' can run smooth on my older devices