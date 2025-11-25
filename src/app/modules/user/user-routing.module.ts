import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ListEntrepriseComponent } from "./pages/list-entreprise/list-entreprise.component";
import { ListUserComponent } from "./pages/list-user/list-user.component";
import { UserComponent } from "./pages/user/user.component";

const routes: Routes = [
  {
    path: "",
    children: [
      {
        path: "users",
        component: UserComponent,
      },
      // {
      //   path: "entreprises",
      //   component: ListEntrepriseComponent,
      // },
    ],
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserRoutingModule {}
