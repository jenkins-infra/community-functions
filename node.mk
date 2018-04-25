all: check

check: depends index.js
	../tools/node npm test

depends: package-lock.json

package-lock.json: package.json
	../tools/node npm install

clean:
	rm -rf node_modules package-lock.json

.PHONY: all check clean depends
