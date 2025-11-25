import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";

import { LayerRoutingModule } from "./layer-routing.module";
import { SharedModule } from "src/app/shared/shared.module";
import { AddGroupComponent } from "./pages/add-group/add-group.component";
import { ListGroupComponent } from "./pages/list-group/list-group.component";
import { AddLayerComponent } from './pages/add-layer/add-layer.component';
import { AddIconDialogComponent } from './pages/add-icon-dialog/add-icon-dialog.component';
import { IconsModule } from "../icons/icons.module";
import { LayerDetailsComponent } from './pages/layer-details/layer-details.component';
import { EditLayerComponent } from './pages/edit-layer/edit-layer.component';
import { LayerStyleComponent } from './pages/layer-style/layer-style.component';
import { ListFieldComponent } from './pages/list-field/list-field.component';
import { LayerViewerComponent } from './pages/layer-viewer/layer-viewer.component';
import { EditStyleComponent } from "./pages/layer-style/edit-style/edit-style.component";
import { PolygonSimpleComponent } from "./pages/layer-style/polygon-simple/polygon-simple.component";
import { ClusterComponent } from "./pages/layer-style/cluster/cluster.component";
import { LineSimpleComponent } from "./pages/layer-style/line-simple/line-simple.component";
import { PointDiagramSimpleComponent } from "./pages/layer-style/point-diagram-simple/point-diagram-simple.component";
import { PointIconSimpleComponent } from "./pages/layer-style/point-icon-simple/point-icon-simple.component";
import { QmlComponent } from "./pages/layer-style/qml/qml.component";
import { LayerDetailsLayoutComponent } from './pages/layer-details-layout/layer-details-layout.component';
import { LayerRightComponent } from './pages/layer-right/layer-right.component';
import { SearchUserComponent } from './pages/search-user/search-user.component';
import { ChangeGroupModalComponent } from './pages/list-group/change-group-modal/change-group-modal.component';
import { GroupItemComponent } from './pages/list-group/group-item/group-item.component';
import { SheetLayerComponent } from './pages/sheet-layer/sheet-layer.component';
import { AddTabComponent } from './pages/add-tab/add-tab.component';


@NgModule({
  declarations: [
    AddGroupComponent, 
    ListGroupComponent, 
    AddLayerComponent, 
    AddIconDialogComponent, 
    LayerDetailsComponent, 
    EditLayerComponent, 
    LayerStyleComponent, 
    ListFieldComponent, 
    LayerViewerComponent,
    EditStyleComponent,
    PolygonSimpleComponent,
    ClusterComponent,
    LineSimpleComponent,
    PointDiagramSimpleComponent,
    PointIconSimpleComponent,
    QmlComponent,
    LayerDetailsLayoutComponent,
    LayerRightComponent,
    SearchUserComponent,
    ChangeGroupModalComponent,
    GroupItemComponent,
    SheetLayerComponent,
    AddTabComponent
  ],
  imports: [CommonModule, LayerRoutingModule, SharedModule, IconsModule],
})
export class LayerModule { }
