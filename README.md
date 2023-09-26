# TCM-Remote
*A simple remote to sync TCM (CML) scripts*

## Set up
1. Create a `config.json` file. See below for the reference.
2. Run `npm install` to install all dependencies.
3. Run `npm run server` to start the server.

## Config file
**All** keys are required!

```json
{
  "scripts": "/full/path/to/scripts/cache/",
  "port": "5432"
}
```

## Recommendations
For security and such, you might want to run this behind software like `nginx`. Additionally, you might want to add some headers to the code to enable caching. This was written when I was just hurrying to get something working.