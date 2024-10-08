import { Component, OnInit, Input, HostListener } from '@angular/core';
import { Inject } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TableauDashboard } from '../common/models/tableau-dashboard';
import { Router, ActivatedRoute } from '@angular/router';
import axios, {AxiosRequestConfig} from 'axios';
import { Auth } from '../common/models/authentication';
import SessionHelper from '../common/user-session';
import TableauHelper from '../common/tableau-helper';

@Component({
  selector: 'app-tableau-embedded-viz',
  templateUrl: './tableau-embedded-viz.component.html',
  styleUrls: ['./tableau-embedded-viz.component.css']
})
export class TableauEmbeddedVizComponent implements OnInit {

  constructor(public dialog: MatDialog, private router: Router, private activatedRoute:ActivatedRoute){}

  //  Inherit attributes from the parent component
  @Input() dashboardIndex = 0;
  @Input() toolbar = 'hidden';
  @Input() vizUrl = '';

  //  Dashboard properties
  public VizIndex = 'Tableau-Viz-' + this.dashboardIndex;
  public isFavorite = false;
  public dashboardName = '';
  public viewIsFavorite = "favorite_border"
  public thisViz: any;
  public auth = {} as Auth
  public dashboard = {} as TableauDashboard;
  public connectedAppToken = '';

  //  Handle dashboard resizing
  public getScreenWidth: any;
  public getScreenHeight: any;
  private calculateDashboardSize = () => {
    const bufferSize = 25;
    this.getScreenWidth = window.innerWidth-bufferSize;
    this.getScreenHeight = (window.innerWidth-bufferSize)*3/4;
  }
  @HostListener('window:resize', ['$event'])
  onWindowResize() {
    this.calculateDashboardSize();
  }

  async ngOnInit(): Promise<void> {
    console.log(`Init the visualize view`);
    this.calculateDashboardSize();

    //  Retrieve the user's session details from local storage
    this.auth = SessionHelper.load();

    //  Fetch the dashboard's details from the ID in the URL
    this.activatedRoute.params.subscribe(async params => {
      console.log(`The is a load dashboard event with id ${params['id']}`);
      //  Save a reference to the dashboard as a whole
      this.dashboard = await this.getDashboard(params['id']);

      //  Make sure we've got a valid dashboard id
      console.log(`Loaded viz dashboard with id ${this.dashboard.id}`);
      if (this.dashboard.id) {

        //  Generate a JWT for SSO
        this.connectedAppToken = await this.getJwt(this.auth.encryptedUserId);
        console.log(`Connected app token ${this.connectedAppToken}`)
        //  Determine the URL for embedding this dashboard
        this.vizUrl = `${this.auth.tableauBaseUrl}/views/${this.dashboard.workbook.contentUrl}/${this.dashboard.viewUrlName}`;
        console.log(`set the viz url to ${this.vizUrl}`);
        //  Figure out if this view is in the user's favorites list
       this.getFavorite(this.dashboard.id)
      }
    });

  }

  //  Run after the component has been rendered
  ngAfterViewInit() {

    //  Define a function that can be run, on
    let viz = document.getElementById(this.VizIndex);
    if (viz) {
      //  Add event handler to trigger once the viz is finished loading
      viz.addEventListener("firstinteractive", async (event) => {
        //  Need to cast the HtmlElement to an object (for TypeScript)
        this.thisViz = <any>viz;
        //  Update the name and attributes of this dashboard
        this.dashboardName = this.thisViz.workbook.activeSheet.name;
      });
    }
  }

  //  Method to get info about a specific dashboard
  private getDashboard = (id: string) => {

    // Do we have an Id?
    if (id.length<=0 && this.auth.apiToken.length>0) {

      //  Return an emtpy dashboard if no ID supplied
      return TableauHelper.createDashboard(null);
    } else {

      //  Fetch the dashboard details via API call
      const options: AxiosRequestConfig = {
        'method': 'GET',
        'url': `/api/dashboards/${id}?apiToken=${this.auth.apiToken}&siteId=${this.auth.siteId}`
      }

      //    Make the API call and return the results
      return axios(options).then(response => {
        console.log(`Get dashboard data ${response.data}`);
        if (response.data.error){

          //  Return an empty string,
          return TableauHelper.createDashboard(null);
        } else {

          //  Return a JWT for the connected app
          return TableauHelper.createDashboard(response.data.view);
        }
      })
    }
  }

  //  Method to return a JWT for Tableau SSO
  private getJwt = (encryptedUserId: string):any => {

    // Define option
    const options: AxiosRequestConfig = {
      'method': 'GET',
      'url': `/api/jwt?encryptedUserId=${encryptedUserId}`
    }

    //    Make the API call and return the results
    return axios(options).then(response => {
      if (response.data.error){

        //  Return an empty string,
        return ''
      } else {

        //  Return a JWT for the connected app
        console.log(`JWT token : ${response.data.connectedAppToken}`)
        return response.data.connectedAppToken;
      }
    })
  }

  //  Method to update the icon, after a status change
  private setFavoriteIcon = (isFavorite:boolean) => {
    this.isFavorite = isFavorite;
    this.viewIsFavorite = isFavorite ? "favorite" : "favorite_border"
  }

  //  Method to determine if the current viz is a favorite
  private getFavorite = (vizId:string) => {
    let thisComponent = this;

    // Define options
    const options: AxiosRequestConfig = {
      'method': 'GET',
      'url': `/api/dashboardFavorite?siteId=${this.auth.siteId}&viewId=${vizId}&apiToken=${this.auth.apiToken}&tableauUserId=${this.auth.tableauUserId}`
    }

    //    Make the API call and return the results
    axios(options).then(response => {
      if (response.data.error){
        //  Error with the API call, return false by default
        console.log(console.error);
      } else {
        //  This API call returns a list of the user's favorites.  Need to parse the list and see if this view is included
        thisComponent.setFavoriteIcon(response.data.isFavorite)
      }
    })
  }

  //  Method to update the dashboard's favorite status
  public setFavorite = (isFavorite:boolean) =>{

    let thisComponent = this;

    // Define options
    const options: AxiosRequestConfig = {
      'method': 'POST',
      'data': {
        'viewId': this.dashboard.id,
        'viewName': this.dashboard.name,
        'tableauUserId': this.auth.tableauUserId,
        'siteId': this.auth.siteId,
        'apiToken': this.auth.apiToken,
        'markFavorite': !isFavorite
      },
      'url': `/api/dashboardFavorite`
    }

    //    Make the API call and return the results
    axios(options).then(response => {
      if (response.data.error){
        //  Return an empty string,
        console.log(console.error);
      } else {
        //  Favorite saved, update the icon
        thisComponent.setFavoriteIcon(response.data.isFavorite)
      }
    })
  }

  //  Method to reset the dashboard filters
  public resetFilters = () => {
    //  Use the Embeding API to revert all filter changes
    this.thisViz.revertAllAsync()
  }

  //  Method to download the dashboard as a PDF
  public downloadPdf = () => {

    let dash = this.dashboard;

    // Define option
    const options: AxiosRequestConfig = {
      'method': 'GET',
      'responseType': 'arraybuffer',
      'url': `/api/dashboardExport?apiToken=${this.auth.apiToken}&siteId=${this.auth.siteId}&viewId=${dash.id}`
    }

    //    Make the API call to download the PDF
    axios(options)
      .then(response => {

          //Create a Blob from the PDF Stream
          const newBlob = new Blob(
            [response.data],
            {type: 'application/pdf'});

          // Create a link pointing to the ObjectURL containing the blob.
          const data = window.URL.createObjectURL(newBlob);
          let link = document.createElement('a');
          link.href = data;
          link.download=`${dash.name}.pdf`;
          link.click();
          setTimeout(function(){
            // For Firefox it is necessary to delay revoking the ObjectURL
            window.URL.revokeObjectURL(data);
          }, 100);
      })
  }

  //  Open a modal window with more details of the workbook
  public openDialog() {
    this.dialog.open(TableauEmbeddedVizComponentDialog, {
      minWidth: 350,
      data: this.dashboard
    });
  }

  //  Close out of this page
  public closeDashboard = () => {
    //  Business Logic goes here
    this.router.navigateByUrl('home');
  }
}

//  Declare the component for providing more details via a modal window
@Component({
  selector: 'app-tableau-embedded-viz-details',
  templateUrl: 'tableau-embedded-viz-details.component.html',
})
export class TableauEmbeddedVizComponentDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: TableauDashboard) {}

  //  Format dates, using TableauHelper
  public dateFormatter = (myDate:Date) => {
    return TableauHelper.dateFormatter(myDate);
  }
}
