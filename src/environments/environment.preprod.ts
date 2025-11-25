// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  backendUrl: "https://back.abmpreprod.futurmap.net",
  frontendUrl: "https://abmpreprod.futurmap.net",  
  // elevation config
  elevation_project_file: "project_elevation.qgs",
  // The default mapbox style 
  maptilerStyle:"https://api.maptiler.com/maps/ce99f4b3-6497-43b7-81f0-4682810da46c/style.json?key=",
  // The maptiler key
  maptilerKey: "ZfGq0T9JqrraZUDzrSkg",
  primaryColor: '#0d589c',
  mapTilerImageryStyle: "https://api.maptiler.com/maps/hybrid/style.json?key=",
  primaryColorTransparentRgba: "rgba(13, 88, 156, 0.2)"
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
