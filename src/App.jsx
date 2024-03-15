import React, { useState } from "react";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import document from "./KnowledgeBase.txt";

import "./App.css";

function App() {
  const fetchBase = async () => {
    try {
      const result = await fetch(document);
      const text = await result.text();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 700,
        chunkOverlap: 50,
        separators: ["\n\n", "\n", " ", ""], // default setting
      });

      const output = await splitter.createDocuments([text]);

      const sbApiKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbWpmbmRqanN2cHF0d29leW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTAwNTgzNzYsImV4cCI6MjAyNTYzNDM3Nn0.s5w7weREkGnUFwZvUgMEDvXeeRmOO2a_IhQkTXssR2o";
      const sbUrl = "https://wpmjfndjjsvpqtwoeymu.supabase.co";
      const openAIApiKey =
        "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";

      const client = createClient(sbUrl, sbApiKey);

      console.log("hi");
      await SupabaseVectorStore.fromDocuments(
        output,
        new OpenAIEmbeddings({ openAIApiKey }),
        {
          client,
          tableName: "documents",
        }
      );
    } catch (err) {
      console.log(err);
    }
  };

  fetchBase();

  return <></>;
}

export default App;
