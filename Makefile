PROJECTS=analytics-bouncer infra-auto-pr comment-logger

all: check
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

check: depends
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

depends:
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@ || exit 1;)

clean:
	rm -rf node_modules
	$(foreach project, $(PROJECTS), $(MAKE) -C $(project) $@;)


.PHONY: all check clean depends
