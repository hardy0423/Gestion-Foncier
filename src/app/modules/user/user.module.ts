import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";

import { UserRoutingModule } from "./user-routing.module";
import { ListUserComponent } from "./pages/list-user/list-user.component";
import { AddUserComponent } from "./pages/add-user/add-user.component";

import { SharedModule } from "src/app/shared/shared.module";
import { ListEntrepriseComponent } from "./pages/list-entreprise/list-entreprise.component";
import { AddEntrepriseComponent } from "./pages/add-entreprise/add-entreprise.component";
import { UserComponent } from "./pages/user/user.component";
import { UserRightComponent } from "./pages/user-right/user-right.component";
import { SearchLayerComponent } from "./pages/search-layer/search-layer.component";
import { ListGroupUserComponent } from "./pages/list-group-user/list-group-user.component";
import { AddGroupUserComponent } from './pages/add-group-user/add-group-user.component';
import { ChooseGroupComponent } from './pages/choose-group/choose-group.component';
import { EditGroupUserComponent } from './pages/edit-group-user/edit-group-user.component';

@NgModule({
  declarations: [
    ListUserComponent,
    AddUserComponent,
    ListEntrepriseComponent,
    AddEntrepriseComponent,
    UserComponent,
    UserRightComponent,
    SearchLayerComponent,
    ListGroupUserComponent,
    AddGroupUserComponent,
    ChooseGroupComponent,
    EditGroupUserComponent,
  ],
  imports: [CommonModule, SharedModule, UserRoutingModule],
})
export class UserModule {}
