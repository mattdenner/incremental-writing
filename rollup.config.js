module.exports = (config, context) => {
  config.output.exports = 'default';
  config.output.sourcemap = 'inline';
  config.external = ['obsidian'];
  return config;
};
