const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const autoprefixer = require('gulp-autoprefixer');
const del = require('del');
const browserSync = require('browser-sync').create();
const ts = require('gulp-typescript');

function html() {
    return src(['src/**/*.html', '!src/components/**/*.html'])
        .pipe(dest('dist'))
        .pipe(browserSync.stream());
}

function css() {
    return src(['src/**/*.css'])
        .pipe(autoprefixer())
        .pipe(dest('dist'))
        .pipe(browserSync.stream());
}

function tscript() {
    return src(['src/assets/*.ts', 'src/main.ts'])
        .pipe(concat('main.ts'))
        .pipe(ts({
            noImplicitAny: false,
            target: "ES2022",
            outFile: 'main.js',
            moduleResolution: "node"
        }))
        .pipe(dest('dist'))
        .pipe(browserSync.stream());
}

function images() {
    return src(['src/**/*.jpeg', 'src/**/*.jpg', 'src/**/*.png', 'src/**/*.svg', 'src/**/*.webp'])
        .pipe(dest('dist'))
        .pipe(browserSync.stream());
}

function fonts() {
    return src(['src/assets/fonts/**/*'])
        .pipe(dest('dist/assets/fonts'))
        .pipe(browserSync.stream());
}

function clean() {
    return del(['./dist/*']);
}

function dev() {
    browserSync.init({
        server: './dist'
    });
    watch('src/**/*.html', html);
    watch('src/**/*.css', css);
    watch('src/**/*.ts', tscript);
    watch('src/assets/**/*', images);
}
function build() {
    return series(clean, parallel(tscript, css), fonts, images, html);
}

exports.build = build();
exports.dev = series(clean, build(), dev);