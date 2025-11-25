import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeatureEditorDialogComponent } from './feature-editor-dialog.component';

describe('FeatureEditorDialogComponent', () => {
  let component: FeatureEditorDialogComponent;
  let fixture: ComponentFixture<FeatureEditorDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FeatureEditorDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeatureEditorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
