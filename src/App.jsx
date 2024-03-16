import React, { useEffect, useState } from "react";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import document from "./KnowledgeBase.txt";

import "./App.css";

// NOTES

/* 

- Error searching for documents: 57014 canceling statement due to statement timeout null
  at _SupabaseVectorStore._searchSupabase   -- OCCURS AT RETRIEVAL STEP WHEN KNOWLEDGE BASE TOO BIG. IT TAKES TOO LONG FOR IT TO RETRIEVE THE CORRECT VECTORS HENCE SHUTS DOWN

- Error: Missing value for input:     --- This occurs when the input variables are not defined correctly. Make sure the invoke() and object out (in the runnable sequence) all input variables match the same name as in the prompts.

*/ function App() {
  const [convoHistory, setConvoHistory] = useState([]);
  const [inputValue, setInputValue] = useState("");

  // Made these variables global so that we can acccess them later for chaining purposes
  const sbApiKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbWpmbmRqanN2cHF0d29leW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTAwNTgzNzYsImV4cCI6MjAyNTYzNDM3Nn0.s5w7weREkGnUFwZvUgMEDvXeeRmOO2a_IhQkTXssR2o";
  const sbUrl = "https://wpmjfndjjsvpqtwoeymu.supabase.co";
  const openAIApiKey = "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";
  const client = createClient(sbUrl, sbApiKey);

  useEffect(() => {
    const fetchBase = async () => {
      try {
        const result = await fetch(document);
        const text = await result.text();
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 500,
          chunkOverlap: 50,
        });

        const output = await splitter.createDocuments([text]);

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
  }, []);

  // Prompt and chaining

  // Function for retrieving our vector base chunks based on our knowledge. Vectore base chunks are return as array of objects and we only need the pageContent (i.e. the relevant knowledge base chunks)

  const combineDocuments = (docs) => {
    return docs.map((doc) => doc.pageContent).join("\n");
  };

  const llm = new ChatOpenAI({ openAIApiKey });

  const embeddings = new OpenAIEmbeddings({ openAIApiKey });

  const vectorStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
    queryName: "match_documents",
  });

  const retriever = vectorStore.asRetriever();

  const questionTemplate = `Given some conversation history (if any) and a question, convert the question to a standalone question.
  conversationHistory: {convHistory}
  question: {question}
  standalone question:`;

  const questionPrompt = PromptTemplate.fromTemplate(questionTemplate);

  const questionChain = questionPrompt.pipe(llm).pipe(new StringOutputParser());

  const answerTemplate = `You are a helpful and enthusiastic support bot who can answer a given question about based on the context provided and the conversation history. Try to find the answer in the context. If the answer is not given in the context, find the answer in the conversation history if possible. If you really don't know the answer, say "I'm sorry, I don't know the answer to that." And direct the questioner to email help@scrimba.com. Don't try to make up an answer. Always speak as if you were chatting to a friend.
  context: {context}
  conversationHistory: {convHistory}
  question: {question}
  answer: `;

  const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);

  const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

  const retrieverChain = RunnableSequence.from([
    (prevResult) => prevResult.standaloneQuestion,
    retriever,
    combineDocuments,
  ]);
  console.log(retrieverChain);

  const mainChain = RunnableSequence.from([
    {
      standaloneQuestion: questionChain,
      originalInput: new RunnablePassthrough(),
    },
    {
      context: retrieverChain,
      question: ({ originalInput }) => {
        originalInput.question;
      },
      // output objects must have the same name as the input variables otherwise you'll get the error:
      convHistory: ({ originalInput }) => {
        originalInput.convHistory;
      },
    },
    answerChain,
  ]);

  // const convoHistory = [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    await progressConversation();
    setInputValue("");
  };

  async function progressConversation() {
    const response = await mainChain.invoke({
      question: inputValue,
      convHistory: convoHistory,

      // Input variables names in the invoke must be the same as in the prompts
    });
    const updatedConvoHistory = [...convoHistory, inputValue, response];
    setConvoHistory(updatedConvoHistory);
    console.log(updatedConvoHistory);

    convoHistory.push(inputValue);
    convoHistory.push(response);
    console.log(convoHistory);
  }

  return (
    <main>
      <section className="chatbot-container">
        {/* Conversation history */}
        <div className="chatbot-conversation-container">
          {convoHistory.map((msg, index) => (
            <div
              key={index}
              className={`speech ${
                index % 2 === 0 ? "speech-human" : "speech-ai"
              }`}
            >
              {msg}
            </div>
          ))}
        </div>
        {/* Form for new message */}
        <form className="chatbot-input-container" onSubmit={handleSubmit}>
          <input
            name="user-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
          />
          <button className="submit-btn" type="submit">
            CLICK CLAK
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
