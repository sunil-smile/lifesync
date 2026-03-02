#!/bin/bash
# LifeSync startup script
export PATH="/usr/local/opt/node@20/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_TLS_REJECT_UNAUTHORIZED=0

cd /Users/sunil/Desktop/App_CodeBase/lifesync_app
exec /usr/local/opt/node@20/bin/npm run start
