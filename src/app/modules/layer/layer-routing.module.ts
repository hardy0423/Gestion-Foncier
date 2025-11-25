import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayerDetailsLayoutComponent } from "./pages/layer-details-layout/layer-details-layout.component";
import { ListGroupComponent } from "./pages/list-group/list-group.component";

const routes: Routes = [
  {
    path: "",
    children: [
      {
        path: "",
        component: ListGroupComponent,
        children: [
          {
            path: ":group_id/:layer_id",
            component: LayerDetailsLayoutComponent
          }
        ]
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayerRoutingModule { }
