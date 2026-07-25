# Container for the buzzer relay (tools/buzzer-relay.js).
#
# Only used for hosting the relay — the games themselves still need no build step
# and still run by opening a file. Nothing here is involved in that.
#
# The relay serves the site as well as the buzzer endpoints, so a deployed copy
# gives you one https origin for everything: the hub, the join page and the
# relay. That is what removes the need to run anything on the classroom laptop.
FROM node:22-alpine

WORKDIR /app
COPY . .

# hosts set PORT themselves; 8080 is the fallback for a plain `docker run`
ENV PORT=8080
EXPOSE 8080

CMD ["node", "tools/buzzer-relay.js"]
