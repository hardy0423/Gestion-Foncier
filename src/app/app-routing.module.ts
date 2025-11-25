import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "./core/guard/auth.guard";
import { NoAuthGuard } from "./core/guard/no-auth.guard";
import { IsAdminGuard } from "./core/guard/is-admin.guard";
import { ContentLayoutComponent } from "./layout/content-layout/content-layout.component";
import { AuthLayoutComponent } from "./layout/auth-layout/auth-layout.component";
import { ThemeGuard } from "./core/guard/themeGuard.guard";

const routes: Routes = [
  {
    path: "",
    redirectTo: "map",
    pathMatch: "full",
  },
  {
    path: "authent",
    canActivate: [NoAuthGuard],
    component: AuthLayoutComponent,
    children: [
      {
        path: "",
        loadChildren: () =>
          import("./modules/auth/auth.module").then((mod) => mod.AuthModule),
      },
    ],
  },
  {
    path: "map",
    canActivate: [AuthGuard, ThemeGuard.forTheme(1)],
    data: { profil: 1 },
    component: ContentLayoutComponent,
    children: [
      {
        path: "",
        loadChildren: () =>
          import("./modules/map/map.module").then((mod) => mod.MapModule),
      },
    ],
  },
  {
    path: "layers",
    canActivate: [AuthGuard, IsAdminGuard],
    component: ContentLayoutComponent,
    children: [
      {
        path: "",
        loadChildren: () =>
          import("./modules/layer/layer.module").then((mod) => mod.LayerModule),
      },
    ],
  },
  {
    path: "land",
    canActivate: [AuthGuard, ThemeGuard.forTheme(2)],
    component: ContentLayoutComponent,
    data: { profil: 2 },
    children: [
      {
        path: "",
        loadChildren: () =>
          import("./modules/map/map.module").then((mod) => mod.MapModule),
      },
    ],
  },
  {
    path: "user",
    canActivate: [AuthGuard, IsAdminGuard],
    component: ContentLayoutComponent,
    children: [
      {
        path: "",
        loadChildren: () =>
          import("./modules/user/user.module").then((mod) => mod.UserModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
