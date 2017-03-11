'use strict';

const gulp = require('gulp');
const clean = require('gulp-clean');
const exit = require('gulp-exit');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');
const runSequence = require('run-sequence');

const tsProject = ts.createProject('./tsconfig.json');
const tsSrcFiles = [
  './src/**/*.ts',
  './test/**/*.ts'
];

gulp.task('clean', function () {
  return gulp.src('./build', {
    read: false
  })
    .pipe(clean({
      force: true
    }));
});

gulp.task('compile', function () {
  return gulp.src(tsSrcFiles, {
    base: './'
  })
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('./', {
      sourceRoot: './'
    }))
    .pipe(gulp.dest('./build'));
});

gulp.task('default', function (callback) {
  runSequence('clean', 'compile', callback);
});
