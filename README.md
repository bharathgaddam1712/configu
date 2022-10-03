
LOGO - TODO

Prevent application misconfiguration


## What is Configu?


Configu is an E2E application configuration management platform for environment variables, secrets, feature flags, and any configuration related to code. 
We provide engineering teams with a holistic set of tools to handle all aspects of configuration that prevent misconfigurations and critical failures from reaching production.
​
With Configu, teams can collaborate more effectively, be more productive, and have visibility, reliability, and security over configurations.
​
## Get started
​
:::info
No prerequisites to get started!
:::
​
- [CLI](#cli)
- [SDK](#sdk)
- [IDE plugin](#ide-plugin)
​
​
---
## CLI
​
1. Install the latest cli
​
```shell
curl https://configu.io/cli/install.sh | sh
```
​
2. Declare your service schema
​
```shell
Configu init --name "some-schema" --examples
```
​
3. Create a configuration store
​
```shell
Configu store --name "default" --uri "configu://-"
```
​
4. Upsert the configuration schema and initialized values
​
```shell
Configu upsert \
--set "/example" --schema "./some-schema.cfgu.json" \
--config "FOO=value" --config "BAR=bar"
```
​
or use the app interactive form
​
```shell
Configu upsert \
--set "/example" --schema "./some-schema.cfgu.json" \
--interactive
```
​
5. Export the relevant configuration on any format or to any runtime
​
```shell
Configu export \ 
--set "/example" --schema "./some-schema.cfgu.json" \
--format "Dotenv" \
> ".env"
```
and you will get a .env file for the example set
​
```.env
FOO=value
BAR=bar
BAZ=value&bar
```
​
---
## SDK
​
TODO
​
​
---
## IDE plugin
​
TODO
​
​
---
## Contributing
​
Contributions are much welcome!
​

We encourage you to to give back to the community and implement:
- SDK for new code languages
- Plugin to more IDEs
- Parser for additional
- New integrations to other 3rd parties
​

We will provide a contributing guide soon. In the meantime, you can contact us and we'd love to help!
​
## Help & Community ��
​
Join our [Slack](https://configu.slack.com) for questions, support and feedback.
​
## Privacy
​
We know how sensitive your configuration data and your 3rd party tokens are, so we build Configu with security by design.
Your secrets / 3rd party tokens are visible and processed only on our open-source tools and they operate locally only.  
​
## License
[Apache Version 2.0](./LICENSE)