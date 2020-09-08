PROJECTS=analytics-bouncer infra-auto-pr comment-logger evergreen-upload

all: check
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

check: depends
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

depends:
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

run:
	docker run --net host --rm -ti \
		-e GITHUB_TOKEN=$$GITHUB_TOKEN \
		-e JENKINS_AUTH=$$JENKINS_AUTH \
		-v $(PWD):$(PWD) -w $(PWD) \
		rtyler/azure-functions func start

clean:
	rm -rf node_modules
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@;)


.PHONY: all check clean depends
