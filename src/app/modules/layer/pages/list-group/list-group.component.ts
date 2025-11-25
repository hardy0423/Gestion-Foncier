import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "app-list-group",
  templateUrl: "./list-group.component.html",
  styleUrls: ["./list-group.component.scss"],
})
export class ListGroupComponent implements OnInit {
  constructor(
    public router: Router,
  ) {}
  ngOnInit(): void {}

  // Close layers page and redirect to map page
  closeLayer() {
    this.router.navigate([""]);
  }
}
