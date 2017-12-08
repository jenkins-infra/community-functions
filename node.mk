all: check

check: depends index.js
	../node npm test

depends: package-lock.json

package-lock.json: package.json
	../node npm install

clean:
	rm -rf node_modules

.PHONY: all check clean depends
