# TCM-Remote
*A simple remote to sync TCM (CML) scripts*

## Set up
1. Create a `.env` file. See below for the reference.
2. Create an empty `tcm.db` file.
3. Run `npm install` to install all dependencies.
4. Run `npx prisma db push` to sync the database schema.
5. Run `npm run server` to start the server.

## Env file
The `STORAGE` key is required. 
All other keys have a default value.

```dotenv
STORAGE=/full/path/to/where/you/want/everything/to/be/stored
LOAD=name:/directory/to/load:true:false;second_name:/directory/to/load:false:true
DEFAULT_USER=default_created_user_name
DEFAULT_EMAIL=email_for_default_user
DEFAULT_PASS=password_for_default_user
```

 | Key             | Default value    | Meaning                                                                                                                                                 |
 |-----------------|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
 | `STORAGE`       | (none)           | This directory is used as the cache for all scripts (it has to exist already). Uploaded and loaded scripts will be copied to this directory.            |
 | `LOAD`          | (empty)          | A list of directories to be copied into the system upon the first load. All `*.cml` files in these directories will be copied to the cache (see below). |
 | `DEFAULT_USER`  | `admin`          | The username for the default-created user (this user has admin rights).                                                                                 |
 | `DEFAULT_EMAIL` | `admin@test.com` | The e-mail address for the default-created user.                                                                                                        |
 | `DEFAULT_PASS`  | `admin`          | The password for the default-created user.                                                                                                              |

The format for the `LOAD` key is a list, separated by semicolons (`;`). Each element has four parts, separated by colons (`:`):
1. The name of the (virtual) directory in the cache where you want this directory to be loaded (use forward slashes (`/`) to create a tree-structure in the cache);
2. The full path to the local directory containing the scripts. Only files with the `.cml` extension will be considered;
3. Whether the path should be loaded recursively (`true` means all subdirectories will be loaded recursively and created as subdirectories in the cache). If `false`, no subdirectories will be loaded.
4. Whether the cache directory should be readable by any user (`true` gives the `@everyone` group read-permissions; `false` gives no group any permissions).

*Note:* admins (users in the `admin`) will always have full permission on every directory and file in the cache.

## Recommendations
For security and such, you might want to run this behind software like `nginx`.