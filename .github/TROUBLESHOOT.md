# TROUBLESHOOT

## Development

### Limit of file watchers reached

Error: ENOSPC: System limit for number of file watchers reached
[Stackoverflow answer](https://stackoverflow.com/questions/55763428/react-native-error-enospc-system-limit-for-number-of-file-watchers-reached)

```
# insert the new value into the system config
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p

# check that the new value was applied
cat /proc/sys/fs/inotify/max_user_watches

# config variable name (not runnable)
fs.inotify.max_user_watches=524288
```

### EsLint shows error in GitHub Actions

```
Sometimes the hidden local errors are caused by the EsLint cache.
To fix this, you can delete the cache file and run the EsLint again.
```

## To test the upload component in the example folder

### Aws (localstack)

You need to install the [awscli-local](https://github.com/localstack/awscli-local).

```bash
pip install awscli-local
```

To create a bucket in localstack, you can use the following command:

```bash
awslocal s3 mb s3://my-test-bucket
```

### Google Cloud Storage

