# Compatibility: ly.img.filter.lut

This directory exists for backward compatibility with scenes created before the
v5 asset restructuring.

## Background

In v5, `ly.img.filter.lut` and `ly.img.filter.duotone` were merged into a single
`ly.img.filter` asset source. The LUT PNG files moved from
`ly.img.filter.lut/LUTs/` to `ly.img.filter/LUTs/`.

Scenes created with previous versions store absolute LUT file URLs using the old
path (e.g. `{baseURL}/ly.img.filter.lut/LUTs/imgly_lut_ad1920_5_5_128.png`).
Without this compatibility directory, those URLs would 404 when customers upgrade
their hosted assets.

## Structure

`LUTs/` is a symlink to `../ly.img.filter/LUTs/` so no files are duplicated.

## When can this be removed?

This can be removed once we are confident that no customer scenes in the wild
still reference the old `ly.img.filter.lut/` path. Given that scenes can be
stored indefinitely, this should be kept for the foreseeable future.
