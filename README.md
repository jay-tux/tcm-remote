# TCM-Remote
*A simple remote to sync TCM (CML) scripts*

## Set up
1. Create a `.env` file. See below for the reference.
2. Create an empty `tcm.db` file.
3. Run `npm install` to install all dependencies.
4. Run `npx prisma db push` to sync the database schema.
5. Run `npm run server` to start the server.

## Env file
**All** keys are required!

```dotenv
STORAGE=/full/path/to/where/you/want/everything/to/be/stored
```

## Recommendations
For security and such, you might want to run this behind software like `nginx`. Additionally, you might want to add some headers to the code to enable caching. This was written when I was just hurrying to get something working.