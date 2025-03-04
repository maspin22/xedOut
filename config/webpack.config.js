const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map',
  entry: {
    popup: path.resolve(__dirname, '../src/popup.js'),
    contentScript: path.resolve(__dirname, '../src/contentScript.js')
  },
  output: {
    path: path.resolve(__dirname, '../public'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, '../src/popup.html'), 
          to: path.resolve(__dirname, '../public/popup.html')
        },
        { 
          from: path.resolve(__dirname, '../src/popup.css'), 
          to: path.resolve(__dirname, '../public/popup.css')
        }
      ]
    })
  ]
};