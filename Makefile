PROJECTS=analytics-bouncer infra-auto-pr comment-logger incrementals-publisher

all: check
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

check: depends
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

depends:
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

run:
	docker run --net host --rm -ti \
		-e GITHUB_TOKEN=$$GITHUB_TOKEN \
		-e METADATA_URL=$$METADATA_URL \
		-e ARCHIVE_URL=$$ARCHIVE_URL \
		-e ARTIFACTORY_KEY=$$ARTIFACTORY_KEY \
		-e PERMISSIONS_URL=$$PERMISSIONS_URL \
		-e JENKINS_HOST=$$JENKINS_HOST \
		-e INCREMENTAL_URL=$$INCREMENTAL_URL \
		-v $(PWD):$(PWD) -w $(PWD) \
		rtyler/azure-functions func start

clean:
	rm -rf node_modules
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@;)


.PHONY: all check clean depends
