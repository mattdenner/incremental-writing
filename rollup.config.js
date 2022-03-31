var { nodeResolve } = require('@rollup/plugin-node-resolve');

module.exports = (config, context) => {
  config.output.exports = 'default';
  config.output.sourcemap = 'inline';

  config.plugins = config.plugins || [];
  config.plugins.push(nodeREsolve());
  return config;
};
