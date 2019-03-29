import { dest, series, src, task, watch } from 'gulp'
import yargs from 'yargs'
import del from 'del'
import fs from 'fs'
import glob from 'glob'
import { join, basename, extname } from 'path'
import webpack from 'webpack-stream'
import gulpif from 'gulp-if'
import standard from 'gulp-standard'
import notify from 'gulp-notify'
import plumber from 'gulp-plumber'
import rename from 'gulp-rename'
import replace from 'gulp-replace'
import sass from 'gulp-sass'
import sassLint from 'gulp-sass-lint'
import postcss from 'gulp-postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'
import sorter from 'css-declaration-sorter'

let browserSync = require('browser-sync').create()
let { reload } = browserSync

let { title } = require('./package.json')
let { exec } = require('child_process')

/**
 * Set up prod/dev tasks
 */
const PROD = !(yargs.argv.dev)

/**
 * Set up file paths
 */
const _assetsDir = './assets'
const _srcDir = `${_assetsDir}/src`
const _distDir = `${_assetsDir}/dist`
const _devDir = `${_assetsDir}/dev`
const _buildDir = PROD ? _distDir : _devDir

/**
 * Error notification settings
 */
const errorAlert = err => {
  let _notifyOpts = {
    title: 'Gulp <%= error.name %>: <%= error.plugin %>',
    message: '<%= error.stack %>',
    sound: 'Basso'
  }
  notify.onError(_notifyOpts)(err)
}

/**
 * Clean the dist/dev directories
 */
task('clean', () => del(_buildDir))

/**
 * Lints the gulpfile for errors
 */
task('lint:gulpfile', () => {
  return src('gulpfile.*')
    .pipe(standard())
    .pipe(standard.reporter('default'))
    .on('error', errorAlert)
})

/**
 * Lints the source js files for errors
 */
task('lint:js', () => {
  let _src = [
    `${_srcDir}/js/**/*.js`,
    '!**/libs/**/*.js'
  ]

  return src(_src)
    .pipe(standard())
    .pipe(standard.reporter('default'))
    .on('error', errorAlert)
})

/**
 * Lint the Sass
 */
task('lint:sass', () => {
  return src(`${_srcDir}/scss/**/*.scss`)
    .pipe(sassLint({
      'merge-default-rules': true
    }))
    .pipe(sassLint.format())
})

/**
 * Lints all the js files for errors
 */
task('lint', series('lint:gulpfile', 'lint:js', 'lint:sass', cb => cb()))

/*
 * Fixes standardJS errors in Gulpfile
 */
task('standard:gulpfile', () => exec('standard --fix gulpfile.*'))

/*
 * Fixes standardJS errors in JS files
 */
task('standard:js', () => exec(`standard --fix ${_srcDir}/js/**/*.js`))

/**
 * Fixes all the JS files with standardJS
 */
task('standard', series('standard:gulpfile', 'standard:js', cb => cb()))

/**
 * Concatenates, minifies and renames the source JS files for dist/dev
 */
task('scripts', () => {
  return src(`${_srcDir}/js/index.js`)
    .pipe(plumber({ errorHandler: errorAlert }))
    .pipe(webpack({
      entry: `${_srcDir}/js/index.js`,
      output: {
        filename: `index.js`
      },
      mode: PROD ? 'production' : 'development',
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true
              }
            }
          }
        ]
      }
    }))
    .pipe(gulpif(PROD, rename({ suffix: '.min' })))
    .pipe(dest(_buildDir))
    .pipe(reload({ stream: true }))
    .on('error', errorAlert)
    .pipe(
      notify({
        message: `${PROD ? 'Prod' : 'Dev'} scripts have been transpiled${PROD ? ' and minified' : ''}`,
        onLast: true
      })
    )
})

/**
 * Compiles and compresses the source Sass files for dist/dev
 */
task('styles', () => {
  const _sassOpts = {
    outputStyle: 'expanded',
    sourceComments: !PROD,
    includePaths: ['./node_modules/reveal.js/']
  }

  const _postcssOpts = [
    sorter({ order: 'smacss' }),
    autoprefixer({ grid: true })
  ]

  if (PROD) _postcssOpts.push(cssnano())

  src(`./node_modules/reveal.js/`)
    .pipe(dest(_buildDir))

  return src(`${_srcDir}/scss/style.scss`)
    .pipe(plumber({ errorHandler: errorAlert }))
    .pipe(sass(_sassOpts))
    .pipe(gulpif(PROD, rename({ suffix: '.min' })))
    .pipe(postcss(_postcssOpts))
    .pipe(dest(_buildDir))
    .pipe(reload({ stream: true }))
    .on('error', errorAlert)
    .pipe(
      notify({
        message: `${PROD ? 'Prod' : 'Dev'} styles have been compiled${PROD ? ' and minified' : ''}`,
        onLast: true
      })
    )
})

const sectionizeFile = file => `<section>${fs.readFileSync(file)}</section>`

const filename = file => basename(file, extname(file))

const dirToContent = dir => {
  let content = ''
  let contents = fs.readdirSync(dir).sort((a, b) => {
    return parseInt(filename(a)) < parseInt(filename(b)) ? -1 : 1
  })

  for (let x of contents) {
    x = join(dir, x)

    if (fs.statSync(x).isFile()) {
      content += sectionizeFile(x)
    } else if (fs.statSync(x).isDirectory()) {
      content += dirToContent(x)
    }
  }

  return content
}

/**
 * Compiles slide files to index.html
 */
task('content', () => src('./index.html')
  .pipe(replace(/{{slides}}/, dirToContent(`${_srcDir}/content/`)))
  .pipe(replace(/{{title}}/, title))
  .pipe(dest(_buildDir))
)

/**
 * Builds for distribution (staging or production)
 */
task('build', series('clean', 'content', 'styles', 'scripts', cb => cb()))

/**
 * Builds assets and reloads the page when any php, html, img or dev files change
 */
task('watch', series('build', () => {
  browserSync.init({
    server: {
      baseDir: _buildDir
    },
    notify: true
  })

  watch(`${_srcDir}/scss/**/*`, series('styles'))
  watch(`${_srcDir}/js/**/*`, series('scripts'))
  watch(`${_srcDir}/content/**/*.{html,md}`, series('content')).on('change', reload)
  watch('./index.html,md').on('change', reload)
}))

/**
 * Backup default task just triggers a build
 */
task('default', series('build', cb => cb()))
