import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { darkTheme, GraphCanvas, GraphEdge, GraphNode } from "reagraph";
import { sort, sortNodes } from "./paths-sort";

function colorForFile(file: { status: "modified" | "added" | "deleted" }) {
  switch (file.status) {
    case "added":
      return "green";
    case "deleted":
      return "red";
    case "modified":
      return "#eac32a";
    default:
      return "black";
  }
}
type File = {
  filename: string;
  status: "modified" | "added" | "deleted";
  additions: number;
  changes: number;
  deletions: number;
};

function summarizeGraph(nodes: GraphNode[], edges: GraphEdge[] = []) {
  let newNodes = nodes;
  let newEdges = edges;

  let intermediateNodes = newNodes.filter((node) => {
    const isIntermediateNode =
      newEdges.filter((edge) => edge.source === node.id).length == 1 &&
      newEdges.filter(
        (edge) => edge.target === node.id && edge.source !== "__ROOT__"
      ).length == 1;

    if (!isIntermediateNode) {
      return false;
    }

    /*
     * Verify that nodes that have parents multiple outbounding edges are not removed
     */
    const sourceEdge = newEdges.find((edge) => edge.target === node.id)!;
    const parentSourceNode = newNodes.find(
      (node) => node.id === sourceEdge.source
    )!;
    const edgesWhereParentSourceNodeIsSource = newEdges.filter(
      (edge) => edge.source === parentSourceNode.id
    );

    if (edgesWhereParentSourceNodeIsSource.length > 1) {
      return false;
    }

    return true;
  });

  while (intermediateNodes.length > 0) {
    const nodeToRemove = intermediateNodes[0];
    intermediateNodes = intermediateNodes.slice(1);

    const sourceEdge = newEdges.find(
      (edge) => edge.target === nodeToRemove.id
    )!;
    const targetEdge = newEdges.find(
      (edge) => edge.source === nodeToRemove.id
    )!;

    const newEdge = {
      id: `${sourceEdge.source}-${targetEdge.target}`,
      source: sourceEdge.source,
      target: targetEdge.target,
    };
    const sourceNode = newNodes.find((node) => node.id === sourceEdge.source)!;
    sourceNode.label = sourceNode.id + "/" + basename(nodeToRemove.id);

    newNodes = newNodes.filter((node) => node.id !== nodeToRemove.id);
    newEdges = newEdges
      .filter((edge) => edge.id !== sourceEdge.id && edge.id !== targetEdge.id)
      .concat(newEdge);
  }

  return { nodes: newNodes, edges: newEdges };
}

const prUrl = new URLSearchParams(location.search).get("pr")!;
const organisationName = prUrl
  .split("github.com/")[1]
  .split("/pull")[0]
  .split("/")[0];
const repositoryName = prUrl
  .split("github.com/")[1]
  .split("/pull")[0]
  .split("/")[1];
const prId = prUrl.split("pull/")[1];

export function Graph() {
  const prFilesQuery = useQuery<Array<File>>({
    queryKey: ["pr-files"],
    queryFn: () => getPRFiles(organisationName, repositoryName, prId),
  });
  const repoFilesQuery = useQuery<Array<{ path: string }>>({
    queryKey: ["repo-files"],
    queryFn: () => getRepoFiles(organisationName, repositoryName, "develop"),
  });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    const prFiles = prFilesQuery.data || [];
    // const repoFiles = repoFilesQuery.data || [];

    const allKnownDirectories = getDirectoryNames(
      prFiles.map((file: File) => file.filename) ?? []
    );

    // const contextFiles = prFiles
    //   .flatMap((file: File) =>
    //     repoFiles.filter(
    //       (f) =>
    //         f.path !== file.filename &&
    //         directoryName(file.filename) === directoryName(f.path)
    //     )
    //   )
    //   .filter(
    //     (value, index, self) =>
    //       self.findIndex((v) => v.path === value.path) === index
    //   );

    const rootNode = {
      id: "__ROOT__",
      label: repositoryName,
      data: { type: "root" },
      fill: "#404040",
      size: 8,
      className: "directory",
    };

    const nodes = [rootNode]
      .concat(
        sort(allKnownDirectories).map((directory) => {
          return {
            id: directory,
            label: basename(directory) + "/",
            data: { type: "directory" },
            fill: "#ececec",
            size: 10,
            className: "directory",
          };
        })
      )
      .concat(
        prFiles.map((file) => ({
          id: file.filename,
          label: basename(file.filename)!,
          fill: colorForFile(file),
          size: 10,
          data: { type: "file" },
          className: "file",
        }))
      );
    // .concat(
    //   contextFiles.map((file) => ({
    //     id: file.path,
    //     label: basename(file.path)!,
    //     fill: "#484848",
    //     size: 5,
    //     data: { type: "file" },
    //     className: "file",
    //   }))
    // );

    const edges = prFiles
      .map((file) => {
        const directory = directoryName(file.filename);
        return {
          id: `${directory}-${file.filename}`,
          source: directory || "__ROOT__",
          target: file.filename,
        };
      })
      .concat(
        allKnownDirectories.map((directory) => {
          const parentDirectory = directoryName(directory);
          return {
            id: `${directory}-${parentDirectory}`,
            source: parentDirectory || "__ROOT__",
            target: directory,
          };
        })
      );
    // .concat(
    //   contextFiles.map((file) => {
    //     const directory = directoryName(file.path);
    //     return {
    //       id: `${directory}-${file.path}`,
    //       source: directory || "__ROOT__",
    //       target: file.path,
    //       fill: "#2a2a2a",
    //       style: "dotted",
    //     };
    //   })
    // );

    const { nodes: simplifiedNodes, edges: simplifiedEdges } = summarizeGraph(
      nodes,
      edges
    );

    setNodes(sortNodes(simplifiedNodes, simplifiedEdges));
    setEdges(simplifiedEdges);
  }, [prFilesQuery.data, repoFilesQuery.data]);

  return (
    <>
      <GraphCanvas
        draggable
        theme={darkTheme}
        nodes={nodes}
        edges={edges}
        constrainDragging={true}
        labelType="nodes"
        layoutType={"treeTd2d"}
        layoutOverrides={
          {
            // mode: "td",
            // linkDistance: 10,
          }
        }
      />
    </>
  );
}

function basename(filePath: string) {
  return filePath.split("/").pop();
}

function getDirectoryNames(filePaths: string[]) {
  return Array.from(
    new Set(
      filePaths.flatMap((filePath) => {
        const parts = filePath.split("/").slice(0, -1);
        return parts.map((_part, index) => parts.slice(0, index + 1).join("/"));
      })
    )
  );
}
function directoryName(filePath: string) {
  return filePath.split("/").slice(0, -1).join("/");
}

async function getPRFiles(
  organisation: string,
  repoName: string,
  prId: string
) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };
  const prUrl = `https://api.github.com/repos/${organisation}/${repoName}/pulls/${prId}`;

  let allFiles: any = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${prUrl}/files?per_page=100&page=${page}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    const files = await response.json();
    allFiles = allFiles.concat(files);

    if (files.length < 100) {
      hasMore = false; // No more pages
    } else {
      page += 1;
    }
  }

  return allFiles;
}
async function getRepoFiles(
  organisation: string,
  repoName: string,
  branch: string
) {
  const url = `https://api.github.com/repos/${organisation}/${repoName}/git/trees/${branch}?recursive=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data.tree;
}
