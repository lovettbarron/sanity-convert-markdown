/* eslint-disable */
const fs = require("fs");
const sanityClient = require("@sanity/client");
const groq = require("groq");
const BlocksToMarkdown = require("@sanity/block-content-to-markdown");
const config = {
  projectId: "lze1vo8m",
  dataset: "andrewlbcom",
  useCdn: true,
  apiVersion: "2022-02-03",
  token: "SANITYAUTHTOKEN",
};
const client = sanityClient(config);
const projectId = config.projectId;
const dataset = config.dataset;
console.log(client.config());
const imageOptions = { dl: null };

const { getImageUrl } = BlocksToMarkdown;

const rawOutput = ({ node, children }) =>
  "```" +
  `${node._type}\n` +
  JSON.stringify({ node, children }, null, 2) +
  "```";
const toBlocks = ({ node }) =>
  BlocksToMarkdown(node.body, { serializers, ...config });

const serializers = {
  types: {
    usageExample: rawOutput,
    gotcha: toBlocks,
    protip: toBlocks,
    code: (props) => `\`\`\`${props.node.language}\n${props.node.code}\n\`\`\``,
    image: ({ node }) => {
      return node.asset ? `![](${node.asset.url})` : "NOIMAGE";
    },
    codesandbox: ({ node }) =>
      `<iframe src="https://codesandbox.io/embed/${node.id}?fontsize=14" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>`,
    youtube: ({ node }) =>
      `<iframe width="560" height="315" src="https://www.youtube.com/embed/${node.id}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
  },
  marks: {
    internalLink: (props) => `![${props.children[0]}](${props.mark.link})`,
  },
};

async function getDocs() {
  const filter = '*[_type == "article"]';
  const projection = groq`{
    _id,
    _type,
    "author": author->{name},
    "thumbnail": thumbnail.asset -> {url},
    title,
    blurb,
    slug,
    date,
    body[]{
      ...,
      _type == "image" => {
        ...,
        asset-> {
           url
        }
    },
      children[]{
        ...,
        _type == "muxVideo" => {
            "playbackId": asset->playbackId
          },
       
        _type == "internalLink" => {
            "type": @->_type,
            "slug": @->slug.current,
        }
      }
    }
  }`;
  const query = [filter, projection].join(" ");
  const docs = await client.fetch(query);
  docs.forEach((post) => {
    const { title, blurb, author, thumbnail, body, slug, date } = post;
    const mdslug = slug || title.replace(" ", "-").toLowerCase();
    const content = `
---
layout: post
title: "${title}"
date: "${date.split("T")[0]}",
slug: "${mdslug}",
author: "${author.name}",
thumbnail: "${thumbnail.url}".
description: "${BlocksToMarkdown(blurb)}"
---

${BlocksToMarkdown(body, {
  serializers,
  imageOptions,
  projectId: projectId,
  dataset: dataset,
})}
`;
    const filename = `posts/${date.split("T")[0]}_${mdslug}.md`;
    fs.writeFile(filename, content, function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("The file was saved!", filename);
    });
  });
}
getDocs();
