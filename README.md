<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/othneildrew/Best-README-Template">
    <img src="src/public/hces.webp" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">HCES</h3>

  <p align="center">
      Scrapes Hack Club Events (rn only stardance and flavortown) to provide a API of data for each event with same schema for each API
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template">View Demo</a>
    &middot;
    <a href="https://github.com/othneildrew/Best-README-Template/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/othneildrew/Best-README-Template/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## Getting Started

### Using the pre-existing server

This is already hosted [here](https://hces.gizzy.gay) and should be accessible to any/all hackclubbers registered and with verification status on [HCA](https://auth.hackclub.com)

### Production

To deploy in production this is only going to display the steps for running in docker

### Prerequisites

Git clone the repo as it includes no prebuilt image and requires to build using compose with Dockerfile

```sh
git clone https://github.com/GizzyUwU/HCES.git
```

Build it using docker compose to build the images needed for the containers

```sh
docker compose build
```

Then literally just run with docker compose

```sh
docker compose up -d
```

To run with its own bundled worker set WORKER env to true with no ORCHESTRATOR_URL set and set WORKER_KEY with key from dash to auth it.

### Production - Standerlone worker

If you want to run a worker with your production you instead use the worker-compose.yml with env setup with the correct API key for it (setup in production dash), WORKER env set to true and ORCHESTRATOR_URL set.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Screenshots

<img src="screenshots/1.png" alt="Login">
<img src="screenshots/2.png" alt="Login">
<img src="screenshots/3.png" alt="Login">
<img src="screenshots/4.png" alt="Login">
<img src="screenshots/5.png" alt="Login">
<img src="screenshots/6.png" alt="Login">  

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Development Setup
For developing you need bun installed as this makes use of some bun specific stuff

```sh
git clone https://github.com/GizzyUwU/HCES.git
cd HCES
pnpm install
bun run dev
```

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
