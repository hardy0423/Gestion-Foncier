import * as io from 'jsts/org/locationtech/jts/io';
import { Feature, Map, MapBrowserEvent, View } from 'ol';
import Collection from 'ol/Collection';
import { Attribution, defaults as defaultControls, MousePosition, ScaleLine } from 'ol/control.js';
import Rotate from 'ol/control/Rotate';
import Zoom from 'ol/control/Zoom';
import { Coordinate, createStringXY } from 'ol/coordinate';
import { click, singleClick } from 'ol/events/condition';
import { createEmpty as createEmptyExtent, extend as Extent } from 'ol/extent';
import { boundingExtent, equals as extentEquals, getCenter } from 'ol/extent.js';
import { FeatureLike } from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON.js';
import Polyline from 'ol/format/Polyline';
import Circle from 'ol/geom/Circle';
import WFS from 'ol/format/WFS.js'
import WriteTransactionOptions from 'ol/format/WMSGetFeatureInfo.js'
import Geometry from 'ol/geom/Geometry';
import GeometryCollection from 'ol/geom/GeometryCollection';
import LinearRing from 'ol/geom/LinearRing';
import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import MultiPoint from 'ol/geom/MultiPoint';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { defaults as defaultInteractions, Draw, Modify, Select, Snap } from 'ol/interaction';
import { Group as LayerGroup, Vector as VectorLayer, Layer } from 'ol/layer.js';
import ImageLayer from 'ol/layer/Image.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorImageLayer from 'ol/layer/VectorImage';
import { bbox as bboxStrategy } from 'ol/loadingstrategy.js';
import { unByKey } from 'ol/Observable';
import Overlay from 'ol/Overlay.js';
// import OverlayPositioning from 'ol/OverlayPositioning';
import { Pixel } from 'ol/pixel';
import { fromLonLat, transform as Transform, transformExtent } from 'ol/proj.js';
import { Cluster, ImageStatic } from 'ol/source.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import OSM from 'ol/source/OSM';
import RasterSource from 'ol/source/Raster';
import TileWMS from 'ol/source/TileWMS';
import Source from 'ol/source/Source';
import { default as VectorSource, default as VectorSourceEvent } from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ';
import { getArea, getLength } from 'ol/sphere';
import {
  Circle as CircleStyle, Fill, Icon, Stroke, Text
} from 'ol/style.js';
import Style from 'ol/style/Style';
import {applyTransform} from 'ol/extent';
import {get as getProjection, getTransform} from 'ol/proj';
import {register} from 'ol/proj/proj4';

// var jsts = require('jsts')
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory';

var geometryFactory = new GeometryFactory();
var ol3Parser = new io.OL3Parser(geometryFactory, null);
ol3Parser.inject(Point, LineString,LinearRing,Polygon,MultiPoint, MultiLineString, MultiPolygon, GeometryCollection);

export {
  applyTransform,
  getProjection,
  getTransform,
  register,
  Coordinate,
  FeatureLike,
  Pixel,
  MapBrowserEvent,
  fromLonLat,
  View,
  Map,
  VectorSource,
  GeoJSON,
  bboxStrategy,
  Cluster,
  VectorLayer,
  Style,
  Icon,
  CircleStyle,
  Stroke,
  Fill,
  Text,
  transformExtent,
  createEmptyExtent,
  Extent,
  Feature,
  ImageWMS,
  ImageLayer,
  Zoom,
  Rotate,
  Overlay,
  Point,
  TileLayer,
  Transform,
  Attribution, defaultControls,
  VectorSourceEvent,
  ImageStatic,
  getCenter,
  Polygon,
  LineString,
  defaultInteractions,
  Modify,
  Select,
  unByKey,
  Collection,
  boundingExtent,
  extentEquals,
  singleClick,
  click,
  LayerGroup,
  Snap,
  MultiPolygon,
  MultiLineString,
  XYZ,
  Geometry,
  Draw,
  VectorImageLayer,
  RasterSource,
  getArea,
  getLength,
  Circle,
  TileWMS,
  Polyline,
  ScaleLine,
  MousePosition,
  createStringXY,
  OSM,
  ol3Parser,
  Layer,
  Source,
  WFS,
  WriteTransactionOptions
};
